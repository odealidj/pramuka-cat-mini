package sqlcgen

func (q *Queries) GetDB() DBTX {
	return q.db
}
