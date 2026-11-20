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
        else:
            err.append(f'{where} : type inconnu {t!r} (choice, icons ou swipe)')
        if len(q.get('ask', '')) > 120: err.append(f'{where} : question trop longue (> 120)')
        if not q.get('why'): err.append(f'{where} : explication (why) manquante')
    return err

def build(qid):
    qdir = os.path.join(ROOT, 'quizzes', qid)
    quiz = json.load(open(os.path.join(qdir, 'quiz.json'), encoding='utf-8'))
    base_art, quiz_art = rd('engine', 'art.js'), rd('quizzes', qid, 'art.js') if os.path.exists(os.path.join(qdir, 'art.js')) else ''
    errs = check(quiz, art_keys(base_art) | art_keys(quiz_art), os.path.join(ROOT, 'themes'))
    if errs:
        print(f'✗ {qid} : {len(errs)} erreur(s)'); [print('  -', e) for e in errs]; sys.exit(1)
    theme = json.load(open(os.path.join(ROOT, 'themes', quiz['theme'] + '.json'), encoding='utf-8'))
    css = rd('themes', quiz['theme'] + '.css') + rd('engine', 'base.css')
    engine = rd('engine', 'engine.js')
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
    print(f'✓ {qid} : {len(quiz["questions"])} questions, {len(quiz["rounds"])} manches, version {ver}')
    return quiz

def catalog(quizzes):
    cards = '\n'.join(f'''<a class="card" href="{q['id']}/"><b>{html.escape(q['title'])}</b><span>{html.escape(q.get('tagline', ''))}</span><small>{len(q['questions'])} questions · thème {html.escape(q['theme'])}</small></a>''' for q in quizzes)
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
.card:hover{{transform:translateY(-4px)}}.card b{{font:700 26px Fredoka,sans-serif}}.card small{{color:#5b6b63}}
</style></head><body><main><h1>Quiz Live</h1><p>Des quiz en direct : le grand écran présente, les téléphones répondent, le classement tombe en direct. Choisissez un quiz.</p>
<div class="grid">{cards}</div></main></body></html>
'''
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
    print(f'✓ catalogue : {len(quizzes)} quiz')

if __name__ == '__main__':
    ids = sys.argv[1:] or sorted(d for d in os.listdir(os.path.join(ROOT, 'quizzes')) if os.path.exists(os.path.join(ROOT, 'quizzes', d, 'quiz.json')))
    built = [build(i) for i in ids]
    allq = [json.load(open(os.path.join(ROOT, 'quizzes', d, 'quiz.json'), encoding='utf-8')) for d in sorted(os.listdir(os.path.join(ROOT, 'quizzes'))) if os.path.exists(os.path.join(ROOT, 'quizzes', d, 'quiz.json'))]
    catalog(allq)
