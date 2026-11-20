#!/usr/bin/env python3
"""Joue une partie complète d'un quiz avec 1 grand écran et 3 téléphones simulés.

Prérequis (une seule fois) :
  pip install playwright && playwright install chromium   (ou un Chrome existant via CHROME=/chemin)
  cd tools && npm install peer@1.0.2
Lancement :
  python3 tools/test_live.py tri-dechets
Le script démarre un serveur PeerJS local (127.0.0.1:9000) et un serveur web (127.0.0.1:8080),
puis vérifie que le joueur qui répond toujours juste finit premier et que le podium s'affiche.
Captures d'écran dans /tmp/ql-*.png
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
qid = sys.argv[1] if len(sys.argv) > 1 else 'tri-dechets'
quiz = json.load(open(os.path.join(ROOT, 'quizzes', qid, 'quiz.json'), encoding='utf-8'))
ans = [str(q.get('answer', '')) for q in quiz['questions']]
QS = quiz['questions']
N = len(ans)

srv = os.path.join(ROOT, 'tools', 'peer-server.js')
open(srv, 'w').write("const {PeerServer}=require('peer');PeerServer({port:9000,path:'/',host:'127.0.0.1'});\n")
ps = subprocess.Popen(['node', srv], cwd=os.path.join(ROOT, 'tools'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
web = subprocess.Popen([sys.executable, '-m', 'http.server', '8080', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2)
OPTS = "window.PEER_OPTS={host:'127.0.0.1',port:9000,path:'/',secure:false,config:{iceServers:[]}};"
URL = f'http://127.0.0.1:8080/{qid}/index.html'
errs = []
try:
    with sync_playwright() as p:
        kw = {'executable_path': os.environ['CHROME']} if os.environ.get('CHROME') else {}
        b = p.chromium.launch(**kw)
        def page(w, h):
            c = b.new_context(viewport={'width': w, 'height': h}); c.add_init_script(OPTS); pg = c.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e))); return pg
        host = page(1600, 900); host.goto(URL); host.click('#host')
        host.wait_for_selector('.code', timeout=15000); code = host.inner_text('.code').strip()
        pls = []
        for nick in ['Juste', 'Faux', 'Parfois']:
            pg = page(390, 844); pg.goto(f'{URL}?p={code}'); pg.fill('#nk', nick); pg.click('#nf .big'); pls.append(pg)
        for pg in pls: pg.wait_for_selector('.pbig', timeout=20000)
        host.wait_for_timeout(500); host.screenshot(path='/tmp/ql-lobby.png')
        host.keyboard.press('Space')
        for i in range(N):
            host.wait_for_selector('.inter #nx, #rv', timeout=10000)
            if host.locator('.inter #nx').count(): host.wait_for_timeout(200); host.keyboard.press('Space')
            try: host.wait_for_selector('#rv', timeout=10000)
            except Exception: host.screenshot(path='/tmp/ql-fail.png'); print('échec à la question', i + 1, errs); raise
            for k, pg in enumerate(pls):
                pg.wait_for_selector('#pq [data-v], #pq input, #pq .oitem', timeout=10000)
                q = QS[i]
                if q['type'] in ('number', 'cloud', 'order', 'poll'):
                    if k == 2 and i % 2 == 1: continue
                    if q['type'] == 'number': pg.fill('#nv', str(q['answer'] if k == 0 else q['answer'] * 3)); pg.click('#nform .big')
                    elif q['type'] == 'cloud': pg.fill('#cv', ['génial', 'drôle', 'génial'][k]); pg.click('#cform .big')
                    elif q['type'] == 'poll': pg.locator('#pq [data-v]').nth(k).click()
                    else:
                        order = list(range(len(q['items']))) if k == 0 else list(reversed(range(len(q['items']))))
                        for it in order: pg.click(f'.oitem[data-k="{it}"]')
                        if i == 0 or k == 0: pg.screenshot(path=f'/tmp/ql-order-{k}.png')
                        pg.click('#ook')
                    continue
                if k == 0:
                    if pg.locator('#scard').count():
                        bb = pg.locator('#scard').bounding_box(); cx = bb['x'] + bb['width'] / 2; cy = bb['y'] + bb['height'] / 2
                        d = 160 if ans[i] == 'right' else -160
                        pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + d, cy, steps=8); pg.mouse.up()
                    else: pg.click(f'#pq [data-v="{ans[i]}"]')
                elif k == 1: pg.locator(f'#pq [data-v]:not([data-v="{ans[i]}"])').first.click()
                elif i % 2 == 0: pg.click(f'#pq [data-v="{ans[i]}"]')
            host.wait_for_timeout(300); host.screenshot(path=f'/tmp/ql-live-{i}.png')
            if i % 2 == 1: host.keyboard.press('Space')   # le 3e joueur n'a pas répondu : on révèle à la main
            host.wait_for_selector('.fb', timeout=10000)
            host.wait_for_timeout(800); host.screenshot(path=f'/tmp/ql-rev-{i}.png'); pls[0].screenshot(path=f'/tmp/ql-phone-{i}.png'); pls[1].screenshot(path=f'/tmp/ql-phone1-{i}.png')
            if QS[i]['type'] in ('poll', 'cloud'):
                host.keyboard.press('Space')
            else:
                host.keyboard.press('Space'); host.wait_for_selector('.rows'); host.keyboard.press('Space')
        host.wait_for_selector('.podium'); host.wait_for_timeout(500); host.screenshot(path='/tmp/ql-podium.png')
        res = []
        for pg in pls:
            pg.wait_for_selector('.gain', timeout=10000); res.append(pg.inner_text('.rank'))
        print('rangs :', res)
        assert res[0].startswith('1'), 'le joueur qui répond juste devrait être 1er'
        b.close()
finally:
    ps.terminate(); web.terminate()
print('erreurs JavaScript :', errs or 'aucune')
print(f'✓ partie complète de {N} questions jouée' if not errs else '✗ erreurs détectées')
