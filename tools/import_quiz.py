#!/usr/bin/env python3
"""Transforme un fichier Kahoot ou Wooclap (.xlsx) en brouillon de quiz Quiz Live.

Accepte :
  - le modèle d'import Kahoot (colonnes Question / Answer 1-4 / Time limit / Correct answer(s)) ;
  - le rapport de résultats Kahoot (on y cherche le tableau des questions) ;
  - le modèle d'import Wooclap (Type / Title / Correct / Choice…) : seules les questions MCQ sont reprises.
Usage : python3 tools/import_quiz.py fichier.xlsx mon-quiz "Titre du quiz"
Produit quizzes/mon-quiz/quiz.json (questions à choix, réparties en manches de 6) et un art.js vide.
Le brouillon passe la vérification de build.py ; Claude l'enrichit ensuite (personnages, explications, manches, swipe…).
"""
import json, os, re, sys, unicodedata
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
norm = lambda s: unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower().strip()

def find_table(ws):
    """Repère une ligne d'en-têtes avec une colonne question, au moins 2 colonnes réponse et une colonne bonne réponse."""
    rows = list(ws.iter_rows(values_only=True))
    for r, row in enumerate(rows[:60]):
        h = [norm(c) for c in row]
        qcol = next((i for i, c in enumerate(h) if (c.startswith('question') or c in ('title', 'titre')) and 'number' not in c and 'numero' not in c and 'type' not in c), None)
        acols = [i for i, c in enumerate(h) if re.match(r'^(answer|reponse|answer option)\s*\d', c) or c in ('choice', 'choix')]
        ycol = next((i for i, c in enumerate(h) if c == 'type'), None)
        ccol = next((i for i, c in enumerate(h) if 'correct' in c or 'bonne' in c), None)
        tcol = next((i for i, c in enumerate(h) if 'time' in c or 'temps' in c), None)
        if qcol is not None and len(acols) >= 2 and ccol is not None:
            return rows[r + 1:], qcol, acols[:4], ccol, tcol, ycol
    return None

ycol_seen = False
def parse(path):
    global ycol_seen
    wb = openpyxl.load_workbook(path, data_only=True)
    for ws in wb.worksheets:
        t = find_table(ws)
        if not t: continue
        rows, qcol, acols, ccol, tcol, ycol = t
        ycol_seen = ycol is not None
        out, seen = [], set()
        for row in rows:
            q = str(row[qcol] or '').strip()
            ty = norm(row[ycol]) if ycol is not None else ''
            if ty in ('guessnumber', 'poll', 'openquestion', 'sorting'):
                ch = [str(row[i]).strip() for i in range(ccol + 1, len(row)) if row[i] not in (None, '')]
                raw = str(row[ccol] or '').replace(',', '.').strip()
                if ty == 'guessnumber':
                    try: out.append({'type': 'number', 'ask': q[:120], 'answer': float(raw) if '.' in raw else int(raw)})
                    except ValueError: pass
                elif ty == 'poll' and len(ch) >= 2: out.append({'type': 'poll', 'ask': q[:120], 'options': [c[:75] for c in ch[:4]]})
                elif ty == 'openquestion': out.append({'type': 'cloud', 'ask': q[:120]})
                elif ty == 'sorting' and len(ch) >= 3: out.append({'type': 'order', 'ask': q[:120], 'items': [c[:60] for c in ch[:6]]})
                seen.add(q); continue
            if ycol is not None and ty not in ('mcq', 'quiz', ''): continue
            if not q or q in seen: continue
            opts = [str(row[i]).strip() for i in acols if i < len(row) and row[i] not in (None, '')]
            if len(opts) < 2: continue
            raw = str(row[ccol] or '').strip()
            nums = [int(x) for x in re.findall(r'\d+', raw) if 1 <= int(x) <= len(opts)]
            if nums and not any(norm(raw) == norm(o) for o in opts): ans = nums[0] - 1
            else:
                ans = next((i for i, o in enumerate(opts) if norm(o) == norm(raw) or norm(o) in norm(raw)), None)
                if ans is None: continue
            sec = row[tcol] if tcol is not None and tcol < len(row) and isinstance(row[tcol], (int, float)) else 20
            seen.add(q); out.append({'ask': q[:120], 'options': [o[:75] for o in opts], 'answer': ans, 'time': int(sec)})
        if out: return out, ws.title
    return [], None

def main():
    if len(sys.argv) < 3: print(__doc__); sys.exit(1)
    src, qid = sys.argv[1], sys.argv[2]
    title = sys.argv[3] if len(sys.argv) > 3 else qid.replace('-', ' ').capitalize()
    qs, sheet = parse(src)
    global ycol_seen
    if not qs:
        print('✗ Aucun tableau de questions reconnu dans ce fichier. Envoyez-le à Claude pour adapter le convertisseur.'); sys.exit(1)
    rounds, questions = [], []
    for n, q in enumerate(qs):
        r = n // 6 + 1
        if r > len(rounds): rounds.append({'title': f'Manche {r}', 'text': 'Répondez le plus vite possible.', 'art': 'bulle', 'tint': ['#fff3c4', '#ffe0e8', '#dff0ff', '#e6f7ec'][(r - 1) % 4]})
        base = {'round': r, 'art': 'bulle', 'name': f'Question {n + 1}', 'sub': '', 'bio': '', 'ask': q['ask']}
        if q.get('type') == 'number': base.update(type='number', answer=q['answer'], why=f"Réponse : {q['answer']}.")
        elif q.get('type') == 'poll': base.update(type='poll', options=q['options'])
        elif q.get('type') == 'cloud': base.update(type='cloud')
        elif q.get('type') == 'order': base.update(type='order', items=q['items'], why='Voici le bon ordre.')
        else: base.update(type='choice', options=q['options'], answer=q['answer'], time=q['time'] if q['time'] in (10, 20, 30, 60) else 20, why=f"Bonne réponse : {q['options'][q['answer']]}.")
        questions.append(base)
    quiz = {'id': qid, 'theme': 'rencontre', 'title': title, 'tagline': 'Un quiz importé depuis ' + ('Wooclap' if ycol_seen else 'Kahoot') + '.', 'winner': 'Champion du quiz !',
            'winnerLine': '{nick} remporte la partie.', 'podiumTitle': 'Le podium', 'nickPlaceholder': 'Ton pseudo',
            'gallery': ['bulle', 'heart', 'trophee', 'loupe', 'eleve', 'podium'], 'avatars': ['bulle', 'heart', 'trophee', 'loupe', 'eleve', 'podium'],
            'lobbyArt': 'bulle', 'words': {'correct': 'Bonne réponse !', 'wrong': 'Raté…', 'online': ''}, 'rounds': rounds, 'questions': questions,
            'sources': [f'Import : {os.path.basename(src)} (feuille « {sheet} »)']}
    d = os.path.join(ROOT, 'quizzes', qid); os.makedirs(d, exist_ok=True)
    json.dump(quiz, open(os.path.join(d, 'quiz.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if not os.path.exists(os.path.join(d, 'art.js')):
        open(os.path.join(d, 'art.js'), 'w', encoding='utf-8').write('/* Personnages propres à ce quiz (à dessiner). */\n')
    print(f'✓ {len(questions)} questions importées depuis la feuille « {sheet} » → quizzes/{qid}/quiz.json')

if __name__ == '__main__':
    main()
