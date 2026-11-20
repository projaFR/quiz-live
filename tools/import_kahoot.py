#!/usr/bin/env python3
"""Transforme un fichier Kahoot (.xlsx) en brouillon de quiz Quiz Live.

Accepte :
  - le modèle d'import Kahoot (colonnes Question / Answer 1-4 / Time limit / Correct answer(s)) ;
  - le rapport de résultats téléchargé après une partie (on y cherche le tableau des questions).
Usage : python3 tools/import_kahoot.py rapport.xlsx mon-quiz "Titre du quiz"
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
        qcol = next((i for i, c in enumerate(h) if c.startswith('question') and 'number' not in c and 'numero' not in c and 'type' not in c), None)
        acols = [i for i, c in enumerate(h) if re.match(r'^(answer|reponse|answer option)\s*\d', c)]
        ccol = next((i for i, c in enumerate(h) if 'correct' in c or 'bonne' in c), None)
        tcol = next((i for i, c in enumerate(h) if 'time' in c or 'temps' in c), None)
        if qcol is not None and len(acols) >= 2 and ccol is not None:
            return rows[r + 1:], qcol, acols[:4], ccol, tcol
    return None

def parse(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    for ws in wb.worksheets:
        t = find_table(ws)
        if not t: continue
        rows, qcol, acols, ccol, tcol = t
        out, seen = [], set()
        for row in rows:
            q = str(row[qcol] or '').strip()
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
    if not qs:
        print('✗ Aucun tableau de questions reconnu dans ce fichier. Envoyez-le à Claude pour adapter le convertisseur.'); sys.exit(1)
    rounds, questions = [], []
    for n, q in enumerate(qs):
        r = n // 6 + 1
        if r > len(rounds): rounds.append({'title': f'Manche {r}', 'text': 'Répondez le plus vite possible.', 'art': 'bulle', 'tint': ['#fff3c4', '#ffe0e8', '#dff0ff', '#e6f7ec'][(r - 1) % 4]})
        questions.append({'round': r, 'art': 'bulle', 'name': f'Question {n + 1}', 'sub': '', 'bio': '', 'ask': q['ask'], 'type': 'choice',
                          'options': q['options'], 'answer': q['answer'], 'time': q['time'] if q['time'] in (10, 20, 30, 60) else 20,
                          'why': f"Bonne réponse : {q['options'][q['answer']]}."})
    quiz = {'id': qid, 'theme': 'rencontre', 'title': title, 'tagline': 'Un quiz importé depuis Kahoot.', 'winner': 'Champion du quiz !',
            'winnerLine': '{nick} remporte la partie.', 'podiumTitle': 'Le podium', 'nickPlaceholder': 'Ton pseudo',
            'gallery': ['bulle', 'heart', 'trophee', 'loupe', 'eleve', 'podium'], 'avatars': ['bulle', 'heart', 'trophee', 'loupe', 'eleve', 'podium'],
            'lobbyArt': 'bulle', 'words': {'correct': 'Bonne réponse !', 'wrong': 'Raté…', 'online': ''}, 'rounds': rounds, 'questions': questions,
            'sources': [f'Import Kahoot : {os.path.basename(src)} (feuille « {sheet} »)']}
    d = os.path.join(ROOT, 'quizzes', qid); os.makedirs(d, exist_ok=True)
    json.dump(quiz, open(os.path.join(d, 'quiz.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if not os.path.exists(os.path.join(d, 'art.js')):
        open(os.path.join(d, 'art.js'), 'w', encoding='utf-8').write('/* Personnages propres à ce quiz (à dessiner). */\n')
    print(f'✓ {len(questions)} questions importées depuis la feuille « {sheet} » → quizzes/{qid}/quiz.json')

if __name__ == '__main__':
    main()
