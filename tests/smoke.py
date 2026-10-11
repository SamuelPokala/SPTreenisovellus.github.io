"""Run against npm run preview: python3 tests/smoke.py [base_url]. Requires Python Playwright and Chromium."""
import json, sys
from playwright.sync_api import sync_playwright
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    page.goto(url)
    page.get_by_role('button',name='Ohjelmat',exact=True).click()
    page.get_by_role('button',name='+ Uusi').click()
    page.get_by_label('Ohjelman nimi').fill('Testivoima')
    for name in ['Kyykkytesti','Veto']:
        page.get_by_role('button',name='+ Lisää liike').click()
        page.get_by_label('Liikkeen nimi').last.fill(name)
    page.get_by_label('Sarjat',exact=True).first.fill('1')
    page.get_by_label('Toistot',exact=True).first.fill('5')
    page.get_by_label('Palautus · s').first.fill('60')
    page.get_by_label('Supersettipari').first.select_option(label='Veto')
    assert page.get_by_label('Supersettipari').last.input_value()
    page.get_by_role('button',name='Siirrä Veto ylös').click()
    assert page.get_by_label('Liikkeen nimi').first.input_value()=='Veto'
    page.get_by_role('button',name='Siirrä Veto alas').click()
    page.get_by_role('button',name='Treeni',exact=True).click()
    page.locator('.program').filter(has_text='Testivoima').get_by_role('button',name='Aloita →').click()
    page.get_by_label('Kyykkytesti sarja 1 paino').fill('60')
    page.get_by_role('button',name='Kyykkytesti sarja 1 valmis',exact=True).click()
    assert page.get_by_role('button',name='Kyykkytesti sarja 1 valmis',exact=True).get_attribute('aria-pressed')=='true'
    page.get_by_label('Veto sarja 1 paino').fill('40')
    page.get_by_role('button',name='Veto sarja 1 valmis',exact=True).click()
    assert page.locator('.timer').get_attribute('class')=='timer running'
    page.get_by_role('button',name='Ohita',exact=True).click()
    page.get_by_role('status').filter(has_text='Tallennettu laitteelle').wait_for()
    page.reload()
    assert page.get_by_label('Kyykkytesti sarja 1 paino').input_value()=='60'
    page.get_by_role('button',name='Tallenna treeni',exact=True).click()
    page.get_by_role('button',name='Kehitys',exact=True).click()
    page.get_by_label('Liike',exact=True).select_option(label='Kyykkytesti')
    assert '70.0' in page.locator('.stats').inner_text()
    assert '300 kg' in page.locator('table').inner_text()
    page.get_by_role('button',name='Historia',exact=True).click()
    assert '500 kg' in page.locator('summary').inner_text()
    with page.expect_download() as dl:
        page.get_by_role('button',name='↓ Vie JSON-varmuuskopio').click()
    backup=json.loads(open(dl.value.path()).read())
    assert len(backup['sessions'])==1 and len(backup['programs'])==3
    page.locator('input[type=file]').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"version":9}'})
    page.get_by_role('status').filter(has_text='kelvollinen').wait_for()
    page.get_by_role('button',name='Poista harjoitus',exact=True).click()
    assert page.locator('summary').count()==0
    page.locator('input[type=file]').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
    page.get_by_role('status').filter(has_text='Varmuuskopio palautettu').wait_for()
    assert page.locator('summary').count()==1
    page.get_by_role('button',name='Treeni',exact=True).click()
    page.locator('.program').filter(has_text='Testivoima').get_by_role('button',name='Aloita →').click()
    assert page.get_by_label('Kyykkytesti sarja 1 paino').input_value()=='60'
    assert page.get_by_role('button',name='Kyykkytesti sarja 1 valmis',exact=True).get_attribute('aria-pressed')=='false'
    page.get_by_role('status').filter(has_text='Tallennettu laitteelle').wait_for()
    page.evaluate('navigator.serviceWorker.ready')
    page.reload()
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    context.set_offline(True)
    page.reload()
    page.get_by_label('Kyykkytesti sarja 1 paino').wait_for()
    assert page.get_by_label('Kyykkytesti sarja 1 paino').input_value()=='60'
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.screenshot(path='/tmp/voimatreeni-mobile.png',full_page=True)
    assert not errors,errors
    browser.close()
print('PASS: mobile programs, reordering, supersets, timer, workout, IndexedDB reload, Epley, volume, JSON export/restore, suggestions and offline reload')
