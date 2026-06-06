export default function ResourcesPage() {
  return (
    <>
<div className="res-toolbar">
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" className="search-input" placeholder="按知识点或标题搜索..." id="searchInput"/>
        </div>
        <div className="filter-group" id="filterGroup">
          <button className="filter-btn active">全部</button>
          <button className="filter-btn">知识点讲解</button>
          <button className="filter-btn">思维导图</button>
          <button className="filter-btn">练习题</button>
          <button className="filter-btn">代码示例</button>
          <button className="filter-btn">音频</button>
        </div>
        <div className="view-btns">
          <button className="view-btn active" id="gridViewBtn" title="网格视图">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button className="view-btn" id="listViewBtn" title="列表视图">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>
    </>
  )
}
