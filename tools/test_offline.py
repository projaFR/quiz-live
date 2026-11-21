#!/usr/bin/env python3
"""Teste les modes sans téléphone d'un quiz : « Tester seul » et « Jouer en équipes ».
Usage : CHROME=/usr/bin/google-chrome python3 tools/test_offline.py <id>
Pas besoin de serveur PeerJS. Captures dans /tmp/qo-*.png
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
qid = sys.argv[1] if len(sys.argv) > 1 else 'tri-dechets'
QS = json.load(open(os.path.join(ROOT, 'quizzes', qid, 'quiz.json'), encoding='utf-8'))['questions']
web = subprocess.Popen([sys.executable, '-m', 'http.server', '8081', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = f'http://127.0.0.1:8081/{qid}/index.html'
errs = []

def next_question(pg, i):
    pg.wait_for_selector('.inter #nx, #rv', timeout=10000)
    if pg.locator('.inter #nx').count(): pg.wait_for_timeout(150); pg.keyboard.press('Space')
    pg.wait_for_selector('#rv', timeout=10000)

try:
    with sync_playwright() as p:
        kw = {'executable_path': os.environ['CHROME']} if os.environ.get('CHROME') else {}
        b = p.chromium.launch(**kw)
        # ---- Mode test, seul ----
        pg = b.new_page(viewport={'width': 1600, 'height': 900}); pg.on('pageerror', lambda e: errs.append('solo: ' + str(e)))
        pg.goto(URL); pg.click('#solo')
        for i, q in enumerate(QS):
            next_question(pg, i)
            t = q['type']
            if t in ('choice', 'icons', 'swipe'): pg.click(f'.opt[data-v="{q["answer"]}"]')
            elif t == 'poll': pg.locator('.opt').first.click()
            elif t == 'number': pg.fill('#hnv', str(q['answer'])); pg.click('#hnf .big')
            elif t == 'cloud': pg.fill('#hcv', 'génial'); pg.click('#hcf .big')
            elif t == 'order':
                for k in range(len(q['items'])): pg.click(f'#olist li[data-k="{k}"]')
                pg.click('#hook')
            pg.wait_for_selector('.fb', timeout=10000)
            if i < 3: pg.wait_for_timeout(700); pg.screenshot(path=f'/tmp/qo-solo-{i}.png')
            if t in ('poll', 'cloud'): pg.keyboard.press('Space')
            else: pg.keyboard.press('Space'); pg.wait_for_selector('.rows'); pg.keyboard.press('Space')
        pg.wait_for_selector('.podium'); pg.wait_for_timeout(500); pg.screenshot(path='/tmp/qo-solo-podium.png')
        print('solo : podium affiché, score', pg.inner_text('.p1 .sc'))
        # ---- Mode équipes ----
        pg = b.new_page(viewport={'width': 1600, 'height': 900}); pg.on('pageerror', lambda e: errs.append('équipes: ' + str(e)))
        pg.goto(URL); pg.click('#teams'); pg.wait_for_selector('#tf'); pg.click('[data-n="3"]'); pg.wait_for_selector('#tn2')
        pg.screenshot(path='/tmp/qo-teams-setup.png'); pg.click('#tf .big')
        for i, q in enumerate(QS):
            next_question(pg, i)
            pg.keyboard.press('Space'); pg.wait_for_selector('.fb', timeout=10000)
            if q['type'] not in ('poll', 'cloud'):
                pg.locator('[data-t]').nth(i % 3).click()
                if i % 4 == 0: pg.locator('[data-t]').nth((i + 1) % 3).click()
                if i == 1: pg.screenshot(path='/tmp/qo-teams-rev.png')
                pg.keyboard.press('Space'); pg.wait_for_selector('.rows')
                if i == 1: pg.wait_for_timeout(2200); pg.screenshot(path='/tmp/qo-teams-board.png')
            pg.keyboard.press('Space')
        pg.wait_for_selector('.podium'); pg.wait_for_timeout(500); pg.screenshot(path='/tmp/qo-teams-podium.png')
        print('équipes : podium affiché,', pg.inner_text('.p1 .nm'), pg.inner_text('.p1 .sc'))
        b.close()
finally:
    web.terminate()
print('erreurs JavaScript :', errs or 'aucune')
