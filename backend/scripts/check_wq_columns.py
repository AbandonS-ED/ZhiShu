import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, dbname='zhishu', user='postgres', password='123456')
cur = conn.cursor()
cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'wrong_questions' ORDER BY ordinal_position")
print('wrong_questions columns:')
for r in cur.fetchall():
    print(f'  {r[0]}: {r[1]} (nullable={r[2]})')
cur.close()
conn.close()
