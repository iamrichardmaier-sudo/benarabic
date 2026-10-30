"""
Checks a daily translation answer key (supabase/answer-keys/<day>.json):
every stored correct translation and the model answer must pass every chunk.
Optional second argument: JSON {"<position>": ["attempt", ...]} to see how attempts would be graded.

Usage: python3 scripts/check-answer-key.py supabase/answer-keys/2026-10-31.json
"""
import json,re,sys
d=json.load(open(sys.argv[1]))
def norm(t,keep_hamza=False):
    t=re.sub('[ً-ٰٟـ]','',t)
    if not keep_hamza: t=re.sub('[أإآٱ]','ا',t)
    t=t.replace('ى','ي').replace('ة','ه')
    return re.sub(r'\s+',' ',re.sub(r'[.,!?؟،؛:;"\'«»()\-–—]',' ',t)).strip().split(' ')
def has(att,form,keep_hamza=False):
    a=norm(att,keep_hamza); f=norm(form,keep_hamza); n=len(f)
    for i in range(len(a)-n+1):
        w=a[i:i+n]
        first=w[0]==f[0] or (w[0][:1] in 'وف' and w[0][1:]==f[0])
        if first and w[1:]==f[1:]: return True
    return False
def grade(s,att):
    out=[]
    for ch in s['chunks']:
        st=[m['rule'] for m in ch['mistakes'] if m.get('strict') and has(att,m['text'],True)]
        ok=any(has(att,a) for a in ch['accept'])
        if ok and not st: out.append((ch['en'],'ok')); continue
        ms=[m for m in ch['mistakes'] if not m.get('strict') and has(att,m['text'])] if not ok else []
        alt=[m['rule'] for m in ms if m.get('status')=='alternative']; err=st+[m['rule'] for m in ms if m.get('status')!='alternative']
        out.append((ch['en'],'MISTAKE' if err else 'ALSO OK' if alt else 'unrecognised', err or alt))
    return out
if __name__=='__main__':
    bad=0
    for s in d['sentences']:
        for r in s['reference_translations']+[s['model_answer']]:
            for row in grade(s,r):
                if row[1]!='ok': bad+=1; print('REF FAIL',s['position'],row,'|',r)
    print('reference failures:',bad)
    tests=json.loads(sys.argv[2]) if len(sys.argv)>2 else {}
    for s in d['sentences']:
        for t in tests.get(str(s['position']),[]):
            print('\nSentence',s['position'],':',t)
            for row in grade(s,t): print('  ',row)
    sys.exit(1 if bad else 0)
