#!/usr/bin/env python3
"""Construit les pages jouables à partir des quiz.

Pour chaque dossier quizzes/<id>/ (quiz.json + art.js), produit <id>/index.html :
un seul fichier autonome (moteur + thème + contenu + bibliothèques).
Produit aussi index.html à la racine : le catalogue des quiz.

Usage : python3 tools/build.py            (tous les quiz)
        python3 tools/build.py tri-dechets (un seul)
Le script vérifie chaque quiz avant de construire et s'arrête sur la première erreur.
"""
import hashlib, html, json, os, re, sys
try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
except ImportError:
    openpyxl = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda *p: open(os.path.join(ROOT, *p), encoding='utf-8').read()

def art_keys(js):
    keys = set(re.findall(r'^\s*([A-Za-z_]\w*)\s*:\s*\(', js, re.M))
    keys |= set(re.findall(r'ART\.([A-Za-z_]\w*)\s*=', js))
    return keys

def check(quiz, keys, theme_dir):
    err = []
    need = ['id', 'theme', 'title', 'rounds', 'questions']
    for k in need:
        if k not in quiz: err.append(f'champ manquant : {k}')
    if err: return err
    if not os.path.exists(os.path.join(theme_dir, quiz['theme'] + '.json')):
        err.append(f"thème introuvable : themes/{quiz['theme']}.json")
    for k in quiz.get('avatars', []) + quiz.get('gallery', []) + [quiz.get('lobbyArt'), quiz.get('logoArt')]:
        if k and k not in keys: err.append(f'dessin inconnu (avatars/galerie) : {k}')
    for i, r in enumerate(quiz['rounds'], 1):
        if not r.get('title'): err.append(f'manche {i} : titre manquant')
        if r.get('art') and r['art'] not in keys: err.append(f"manche {i} : dessin inconnu {r['art']}")
    icons = quiz.get('icons', {})
    for n, q in enumerate(quiz['questions'], 1):
        where = f'question {n} ({q.get("name", "?")})'
        if not 1 <= q.get('round', 0) <= len(quiz['rounds']): err.append(f'{where} : manche invalide')
        if q.get('art') and q['art'] not in keys: err.append(f"{where} : dessin inconnu {q['art']}")
        t = q.get('type')
        if t == 'swipe':
            if q.get('answer') not in ('left', 'right'): err.append(f'{where} : answer doit valoir left ou right')
            sw = {**quiz.get('swipe', {}), **quiz['rounds'][q['round'] - 1].get('swipe', {}), **q.get('swipe', {})}
            if not (sw.get('left') and sw.get('right')): err.append(f'{where} : libellés du swipe manquants')
        elif t == 'icons':
            for k in q.get('options', []):
                if k not in icons: err.append(f'{where} : icône inconnue {k}')
            if q.get('answer') not in q.get('options', []): err.append(f'{where} : la réponse n’est pas dans les options')
            if not 2 <= len(q.get('options', [])) <= 4: err.append(f'{where} : 2 à 4 options')
        elif t == 'choice':
            o = q.get('options', [])
            if not 2 <= len(o) <= 4: err.append(f'{where} : 2 à 4 options')
            if not isinstance(q.get('answer'), int) or not 0 <= q['answer'] < len(o): err.append(f'{where} : answer doit être l’index de la bonne option')
            for x in o:
                if len(x) > 75: err.append(f'{where} : option trop longue ({len(x)} > 75) : {x}')
        elif t == 'number':
            if not isinstance(q.get('answer'), (int, float)): err.append(f'{where} : answer doit être un nombre')
            if 'tolerance' in q and not 0 < q['tolerance'] <= 5: err.append(f'{where} : tolerance entre 0 et 5 (0.5 = 50 % d’écart → 0 point)')
        elif t == 'poll':
            o = q.get('options', [])
            if not 2 <= len(o) <= 4: err.append(f'{where} : 2 à 4 options')
            for x in o:
                if len(x) > 75: err.append(f'{where} : option trop longue : {x}')
        elif t == 'cloud':
            pass
        elif t == 'order':
            it = q.get('items', [])
            if not 3 <= len(it) <= 6: err.append(f'{where} : 3 à 6 étiquettes (items), dans le bon ordre')
            for x in it:
                if len(x) > 60: err.append(f'{where} : étiquette trop longue : {x}')
        else:
            err.append(f'{where} : type inconnu {t!r} (choice, icons, swipe, number, poll, cloud, order)')
        if len(q.get('ask', '')) > 120: err.append(f'{where} : question trop longue (> 120)')
        if not q.get('why') and t not in ('poll', 'cloud'): err.append(f'{where} : explication (why) manquante')
    return err


def kahoot_text(q, quiz, maxlen=120):
    """Texte autonome de la question pour Kahoot (sans la carte illustrée)."""
    asks = q.get('ask') or (quiz.get('swipe', {}).get('ask') if q['type'] == 'swipe' else 'Quelle est la bonne réponse ?')
    name, bio = q.get('name', ''), q.get('bio', '')
    if q['type'] == 'swipe':
        t = f"{name} : {bio}" if bio else name
        if len(t + ' ' + asks) <= maxlen: t = t + ' ' + asks
    elif q.get('ask') and q['type'] == 'choice':
        t = asks
    else:
        t = f"{name} : {asks}" if name else asks
    return t

def export_kahoot(quiz, path):
    """Fichier au format du modèle d'import Kahoot (en-têtes ligne 8, questions dès la ligne 9, colonnes B à H)."""
    if openpyxl is None:
        print('  (export Kahoot ignoré : openpyxl absent)'); return []
    warn = []
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Kahoot'
    F, B = Font(name='Arial', size=11), Font(name='Arial', size=11, bold=True)
    ws['B2'] = f"{quiz['title']} – à importer dans Kahoot (Créer > Kahoot > Importer un tableur)"; ws['B2'].font = Font(name='Arial', size=14, bold=True)
    ws['B3'] = 'Généré automatiquement par Quiz Live. Les illustrations sont à ajouter à la main dans Kahoot.'; ws['B3'].font = F
    heads = ['Question - max 120 characters', 'Answer 1 - max 75 characters', 'Answer 2 - max 75 characters', 'Answer 3 - max 75 characters', 'Answer 4 - max 75 characters', 'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs', 'Correct answer(s) - choose at least one']
    for j, h in enumerate(heads):
        c = ws.cell(8, 2 + j, h); c.font = B; c.fill = PatternFill('solid', fgColor='FFCF33'); c.alignment = Alignment(wrap_text=True, vertical='center')
    ok_times = [5, 10, 20, 30, 60, 90, 120, 240]
    w2 = wb.create_sheet('Explications'); 
    for j, h in enumerate(['N°', 'Question', 'Bonne réponse', 'Explication à lire']): c = w2.cell(1, 1 + j, h); c.font = B
    n = 0
    for q in quiz['questions']:
        if q['type'] in ('number', 'poll', 'cloud', 'order'):
            warn.append(f"« {q.get('name', '')} » ({q['type']}) non exporté : Kahoot n’importe que des QCM"); continue
        n += 1
        if q['type'] == 'swipe':
            sw = {**quiz.get('swipe', {}), **quiz['rounds'][q['round'] - 1].get('swipe', {}), **q.get('swipe', {})}
            opts = [sw['left']['label'], sw['right']['label']]; cor = 1 if q['answer'] == 'left' else 2
        elif q['type'] == 'icons':
            opts = [quiz['icons'][k]['label'] for k in q['options']]; cor = q['options'].index(q['answer']) + 1
        else:
            opts = list(q['options']); cor = q['answer'] + 1
        t = kahoot_text(q, quiz)
        if len(t) > 120: warn.append(f'question {n} : {len(t)} caractères (> 120), à raccourcir dans Kahoot')
        sec = min(ok_times, key=lambda x: abs(x - (q.get('time') or quiz['rounds'][q['round'] - 1].get('time') or quiz.get('time') or 20)))
        row = [t] + opts + [None] * (4 - len(opts)) + [sec, str(cor)]
        ws.cell(8 + n, 1, n).font = F
        for j, v in enumerate(row):
            c = ws.cell(8 + n, 2 + j, v); c.font = F; c.alignment = Alignment(wrap_text=True, vertical='top')
        for j, v in enumerate([n, t, opts[cor - 1], q.get('why', '')]):
            c = w2.cell(1 + n, 1 + j, v); c.font = F; c.alignment = Alignment(wrap_text=True, vertical='top')
    for col, w in zip('ABCDEFGH', [5, 60, 28, 28, 28, 28, 16, 16]): ws.column_dimensions[col].width = w
    for col, w in zip('ABCD', [5, 60, 28, 90]): w2.column_dimensions[col].width = w
    ws.row_dimensions[8].height = 45
    wb.save(path)
    return warn

def answers_of(q, quiz):
    if q['type'] == 'swipe':
        sw = {**quiz.get('swipe', {}), **quiz['rounds'][q['round'] - 1].get('swipe', {}), **q.get('swipe', {})}
        return [sw['left']['label'], sw['right']['label']], (1 if q['answer'] == 'left' else 2)
    if q['type'] == 'icons':
        return [quiz['icons'][k]['label'] for k in q['options']], q['options'].index(q['answer']) + 1
    return list(q['options']), q['answer'] + 1

def export_wooclap(quiz, path):
    """Fichier au format du modèle d'import Wooclap : Type | Title | Correct | Choice… (questions MCQ)."""
    if openpyxl is None: return
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Questions'
    ws.append(['Type', 'Title', 'Correct'] + ['Choice'] * 7)
    for q in quiz['questions']:
        t = kahoot_text(q, quiz, maxlen=400)
        if q['type'] == 'number': ws.append(['GuessNumber', t, str(q['answer'])])
        elif q['type'] == 'poll': ws.append(['Poll', t, ''] + list(q['options']))
        elif q['type'] == 'cloud': ws.append(['OpenQuestion', t])
        elif q['type'] == 'order': ws.append(['Sorting', t, None] + list(q['items']))
        else:
            opts, cor = answers_of(q, quiz)
            ws.append(['MCQ', t, str(cor)] + opts)
    ws.column_dimensions['B'].width = 70
    wb.save(path)

BASE_AV = ['fille1', 'garcon1', 'fille2', 'garcon2', 'fille3', 'garcon3', 'fille4', 'garcon4', 'fille5', 'garcon5', 'fille6', 'garcon6', 'chat', 'chien', 'renard', 'panda', 'hibou', 'dino', 'alien', 'robot', 'fantome', 'etoile', 'nuage', 'cactus', 'donut', 'fusee']
GENERIC_AV = ['bulle', 'heart', 'trophee', 'loupe', 'podium', 'eleve']

def all_ids():
    return sorted(d for d in os.listdir(os.path.join(ROOT, 'quizzes')) if os.path.exists(os.path.join(ROOT, 'quizzes', d, 'quiz.json')))

def build(qid):
    qdir = os.path.join(ROOT, 'quizzes', qid)
    quiz = json.load(open(os.path.join(qdir, 'quiz.json'), encoding='utf-8'))
    base_art = rd('engine', 'art.js')
    # Les dessins de TOUS les quiz sont embarqués (ceux du quiz en dernier) : avatars partagés entre quiz.
    arts = {i: (rd('quizzes', i, 'art.js') if os.path.exists(os.path.join(ROOT, 'quizzes', i, 'art.js')) else '') for i in all_ids()}
    quiz_art = '\n'.join(arts[i] for i in all_ids() if i != qid) + '\n' + arts.get(qid, '')
    seen = {}
    for i, js in arts.items():
        for k in art_keys(js):
            if k in seen and seen[k] != i: print(f'  ! dessin « {k} » défini dans {seen[k]} et {i} : renommer l’un des deux')
            seen.setdefault(k, i)
    errs = check(quiz, art_keys(base_art) | art_keys(quiz_art), os.path.join(ROOT, 'themes'))
    if errs:
        print(f'✗ {qid} : {len(errs)} erreur(s)'); [print('  -', e) for e in errs]; sys.exit(1)
    theme = json.load(open(os.path.join(ROOT, 'themes', quiz['theme'] + '.json'), encoding='utf-8'))
    css = rd('themes', quiz['theme'] + '.css') + rd('engine', 'base.css')
    engine = rd('engine', 'engine.js')
    others = [json.load(open(os.path.join(ROOT, 'quizzes', i, 'quiz.json'), encoding='utf-8')).get('avatars', []) for i in all_ids() if i != qid]
    av = []
    for k in BASE_AV + quiz.get('avatars', []) + [x for o in others for x in o] + GENERIC_AV:
        if k not in av: av.append(k)
    quiz = {**quiz, 'avatars': av}
    data = 'const QUIZ=' + json.dumps(quiz, ensure_ascii=False) + ';\nconst THEME=' + json.dumps(theme, ensure_ascii=False) + ';\n'
    ver = hashlib.sha1((css + base_art + quiz_art + data + engine).encode()).hexdigest()[:7]
    page = f'''<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(quiz['title'])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="{theme['fonts']}" rel="stylesheet">
<style>
{css}</style>
<script>{rd('engine', 'vendor', 'qrcode.js')}</script>
<script>{rd('engine', 'vendor', 'peerjs.min.js')}</script>
</head>
<body>
<main id="app"></main>
<script>
{{
{base_art}
{quiz_art}
{data}const VER={json.dumps(ver)};
{engine}
}}
</script>
</body>
</html>
'''
    os.makedirs(os.path.join(ROOT, qid), exist_ok=True)
    open(os.path.join(ROOT, qid, 'index.html'), 'w', encoding='utf-8').write(page)
    kw = export_kahoot(quiz, os.path.join(ROOT, qid, 'kahoot.xlsx'))
    export_wooclap(quiz, os.path.join(ROOT, qid, 'wooclap.xlsx'))
    print(f'✓ {qid} : {len(quiz["questions"])} questions, {len(quiz["rounds"])} manches, {len(av)} avatars, version {ver} (+ kahoot.xlsx, wooclap.xlsx)')
    for w in kw: print('  ! Kahoot :', w)
    return quiz

def catalog(quizzes):
    cards = '\n'.join(f'''<a class="card" href="{q['id']}/"><b>{html.escape(q['title'])}</b><span>{html.escape(q.get('tagline', ''))}</span><small>{len(q['questions'])} questions · thème {html.escape(q['theme'])}</small></a>''' for q in quizzes)
    qcm = lambda q: any(x['type'] in ('choice', 'icons', 'swipe') for x in q['questions'])
    kl = ' · '.join(f'''{html.escape(q['title'])} : ''' + (f'''<a href="{q['id']}/kahoot.xlsx">Kahoot</a> / ''' if qcm(q) else '') + f'''<a href="{q['id']}/wooclap.xlsx">Wooclap</a>''' for q in quizzes)
    page = f'''<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Quiz Live</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
<style>
body{{margin:0;background:#0e3b2e;color:#fff;font:17px/1.5 Nunito,system-ui,sans-serif}}
main{{max-width:960px;margin:0 auto;padding:clamp(24px,5vw,64px) max(4vw,16px)}}
h1{{font:700 clamp(44px,8vw,80px)/1 Fredoka,sans-serif;color:#ffcf33;margin:0 0 10px}}
p{{color:#d9ece2;max-width:36em}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:28px}}
.card{{background:#fff;color:#16241e;border-radius:22px;padding:20px;text-decoration:none;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 0 rgba(0,0,0,.2);transition:transform .15s}}
.card:hover{{transform:translateY(-4px)}}.card b{{font:700 26px Fredoka,sans-serif}}.card small{{color:#5b6b63}}.dl{{margin-top:28px;font-size:15px}}.dl a{{color:#ffcf33}}
</style></head><body><main><h1>Quiz Live</h1><p>Des quiz en direct : le grand écran présente, les téléphones répondent, le classement tombe en direct. Choisissez un quiz.</p>
<div class="grid">{cards}</div><p class="dl">Fichiers à importer dans Kahoot ou Wooclap : {kl}</p></main></body></html>
'''
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
    print(f'✓ catalogue : {len(quizzes)} quiz')

if __name__ == '__main__':
    ids = sys.argv[1:] or all_ids()
    built = [build(i) for i in ids]
    allq = [json.load(open(os.path.join(ROOT, 'quizzes', d, 'quiz.json'), encoding='utf-8')) for d in sorted(os.listdir(os.path.join(ROOT, 'quizzes'))) if os.path.exists(os.path.join(ROOT, 'quizzes', d, 'quiz.json'))]
    catalog(allq)
