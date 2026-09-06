import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Tooltip, Grow } from "@mui/material";
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CompassIcon from '@mui/icons-material/Explore';
import api from "../services/api";
import GeneralContext from "./GeneralContext";
import { useWebSocket } from "../hooks/useWebSocket";

const WatchList = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const { marketData, isConnected } = useWebSocket();
  const navigate = useNavigate();

  const fetchWatchlist = async () => {
    try {
      const res = await api.get('/watchlist');
      setWatchlist(res.data || []);
    } catch (err) {
      console.error('Error fetching watchlist:', err);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  // Live search handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/instruments/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data || []);
      } catch (err) {
        console.error('Error searching instruments:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddSymbol = async (symbol) => {
    try {
      await api.post('/watchlist/add', { symbol });
      setSearchQuery("");
      fetchWatchlist();
    } catch (err) {
      console.error('Error adding to watchlist:', err);
    }
  };

  const handleRemoveSymbol = async (symbol) => {
    try {
      await api.post('/watchlist/remove', { symbol });
      fetchWatchlist();
    } catch (err) {
      console.error('Error removing from watchlist:', err);
    }
  };

  // Drag and Drop reordering handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newList = [...watchlist];
    const [draggedItem] = newList.splice(draggedIndex, 1);
    newList.splice(dropIndex, 0, draggedItem);

    setWatchlist(newList);
    setDraggedIndex(null);

    // Persist reordered symbols to backend
    try {
      const symbolsOrder = newList.map(item => item.symbol);
      await api.post('/watchlist/reorder', { symbols: symbolsOrder });
    } catch (err) {
      console.error('Error persisting reordered watchlist:', err);
      fetchWatchlist(); // revert on error
    }
  };

  // Merge live WebSocket market data into watchlist items
  const displayList = watchlist.map((item) => {
    const live = marketData[item.symbol];
    if (live) {
      return {
        ...item,
        lastPrice: live.lastPrice,
        changePercent: live.changePercent,
        change: live.change,
        marketStatus: live.marketStatus,
        isDown: live.changePercent < 0
      };
    }
    return {
      ...item,
      isDown: (item.changePercent || 0) < 0
    };
  });

  // Determine overall market status from live feed
  const sampleLive = Object.values(marketData)[0];
  const marketStatus = sampleLive?.marketStatus || 'OPEN';
  const isMarketOpen = marketStatus === 'OPEN';

  return (
    <div className="watchlist-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Simulation Banner & Market Status Badge */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        fontWeight: '700',
        color: '#0284c7',
        letterSpacing: '0.5px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isMarketOpen ? '#10b981' : '#f59e0b'
          }}></span>
          <span>MARKET {isMarketOpen ? 'OPEN' : 'CLOSED'}</span>
        </div>
        <span className="badge" style={{
          fontSize: '10px',
          backgroundColor: isConnected ? '#0284c7' : '#94a3b8',
          color: '#ffffff',
          padding: '3px 8px',
          borderRadius: '12px'
        }}>
          SIMULATED
        </span>
      </div>

      {/* Favorites Module Header (Expand / Collapse) */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
        userSelect: 'none'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>My Favorites</span>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {watchlist.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/explore'); }}
            title="Explore All 46 Stocks"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#0284c7',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <CompassIcon style={{ fontSize: '14px' }} /> Explore
          </button>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <>
          {/* Search / Add Input Bar */}
          <div className="search-container">
            <input
              type="text"
              name="search"
              id="search"
              placeholder="Search & add stocks (e.g. RELIANCE, INFY)..."
              className="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="counts">
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#4caf50' : '#f44336', marginRight: '6px' }}></span>
              {watchlist.length}
            </span>
          </div>

          {/* Search Results Dropdown or Watchlist Items */}
          {isSearching && searchResults.length > 0 ? (
            <SearchResults
              results={searchResults}
              onAdd={handleAddSymbol}
              watchlistSymbols={new Set(watchlist.map(w => w.symbol))}
            />
          ) : watchlist.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <StarBorderIcon style={{ fontSize: '44px', color: '#cbd5e1', marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>No Favorites Added</p>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Search above or browse all 46 stocks in Explore.</p>
              <button
                onClick={() => navigate('/explore')}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Browse Explore Stocks
              </button>
            </div>
          ) : (
            <ul className="list" style={{ flex: 1, overflowY: 'auto', margin: 0, padding: 0 }}>
              {displayList.map((stock, index) => {
                return (
                  <WatchListItem
                    key={stock.symbol || index}
                    index={index}
                    stock={stock}
                    onRemove={() => handleRemoveSymbol(stock.symbol)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                  />
                );
              })}
            </ul>
          )}

          {/* Footer hint */}
          <div style={{
            padding: '8px 14px',
            fontSize: '11px',
            color: '#94a3b8',
            textAlign: 'center',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#ffffff'
          }}>
            <DragIndicatorIcon style={{ fontSize: '12px', verticalAlign: 'middle', marginRight: '4px' }} />
            Drag rows to reorder favorites
          </div>
        </>
      )}
    </div>
  );
};

export default WatchList;

const WatchListItem = ({ stock, index, onRemove, onDragStart, onDragOver, onDrop }) => {
  const [hover, setHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  const handleMouseEnter = () => setHover(true);
  const handleMouseLeave = () => setHover(false);

  const price = typeof stock.lastPrice === 'number' ? stock.lastPrice.toFixed(2) : (stock.price || '0.00');
  const percent = typeof stock.changePercent === 'number'
    ? `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`
    : (stock.percent || '0.00%');
  const isDown = stock.isDown || (typeof stock.changePercent === 'number' && stock.changePercent < 0);

  const handleRowClick = (e) => {
    if (isDragging) return;
    if (e.target.closest('.actions') || e.target.closest('.drag-handle')) {
      return;
    }
    const sym = stock.symbol || stock.name;
    navigate(`/stock/${encodeURIComponent(sym)}`);
  };

  const handleDragStartInternal = (e) => {
    setIsDragging(true);
    if (onDragStart) onDragStart(e);
  };

  const handleDragEndInternal = () => {
    setIsDragging(false);
  };

  return (
    <li
      className="favorite-stock-row"
      draggable
      onDragStart={handleDragStartInternal}
      onDragEnd={handleDragEndInternal}
      onDragOver={onDragOver}
      onDrop={(e) => {
        setIsDragging(false);
        onDrop(e);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleRowClick}
      style={{
        cursor: 'pointer',
        transition: 'background-color 0.15s ease, opacity 0.15s ease, transform 0.1s ease',
        backgroundColor: hover ? '#f1f5f9' : 'transparent',
        borderBottom: '1px solid #f1f5f9',
        borderLeft: isDragging ? '3px solid #0284c7' : '3px solid transparent',
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        position: 'relative'
      }}
    >
      {/* Drag handle */}
      <span className="drag-handle" onClick={(e) => e.stopPropagation()} style={{
        cursor: 'grab',
        color: hover ? '#0284c7' : '#cbd5e1',
        paddingLeft: '8px',
        paddingRight: '4px',
        display: 'flex',
        alignItems: 'center',
        transition: 'color 0.15s'
      }}>
        <DragIndicatorIcon style={{ fontSize: '16px' }} />
      </span>

      <div
        className="stock-main"
        onClick={(e) => {
          e.stopPropagation();
          const sym = stock.symbol || stock.name;
          navigate(`/stock/${encodeURIComponent(sym)}`);
        }}
        style={{ flex: 1, paddingLeft: '4px', cursor: 'pointer' }}
      >
        <p className={isDown ? "down" : "up"} style={{ fontWeight: '600', margin: 0 }}>{stock.symbol || stock.name}</p>
        <div className="itemInfo">
          <span className="percent">{percent}</span>
          {isDown ? (
            <ArrowDropDownIcon className="down" />
          ) : (
            <ArrowDropUpIcon className="up" />
          )}
          <span className="price">₹{price}</span>
        </div>
      </div>

      {hover && (
        <WatchListActions uid={stock.symbol || stock.name} onRemove={onRemove} />
      )}
    </li>
  );
};

const WatchListActions = ({ uid, onRemove }) => {
  const { openBuyWindow, openSellWindow } = useContext(GeneralContext);
  return (
    <span className="actions" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', position: 'absolute', right: '10px' }}>
      <span>
        <Tooltip title="Buy (B)" arrow placement="top" TransitionComponent={Grow}>
          <button
            className="buy"
            onClick={(e) => { e.stopPropagation(); openBuyWindow(uid); }}
          >
            Buy
          </button>
        </Tooltip>
        <Tooltip title="Sell (S)" arrow placement="top" TransitionComponent={Grow}>
          <button
            className="sell"
            onClick={(e) => { e.stopPropagation(); openSellWindow(uid); }}
          >
            Sell
          </button>
        </Tooltip>
        <Tooltip title="Remove Favorite" arrow placement="top" TransitionComponent={Grow}>
          <button
            className="action"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <DeleteOutlineIcon className="icon" />
          </button>
        </Tooltip>
      </span>
    </span>
  );
};

// Search results panel
const SearchResults = ({ results, onAdd, watchlistSymbols }) => {
  const navigate = useNavigate();
  return (
    <ul className="list" style={{ margin: 0, padding: 0 }}>
      {results.map((stock, index) => {
        const isFav = watchlistSymbols.has(stock.symbol);
        return (
          <li
            key={index}
            style={{
              padding: '10px 14px',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e2e8f0',
              transition: 'background-color 0.15s ease'
            }}
          >
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>{stock.symbol}</span>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{stock.companyName || stock.name}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '600', fontSize: '12px', color: '#0284c7' }}>
                ₹{typeof stock.lastPrice === 'number' ? stock.lastPrice.toFixed(2) : '0.00'}
              </span>
              <button
                onClick={() => navigate(`/stock/${encodeURIComponent(stock.symbol)}`)}
                style={{ background: 'none', color: '#0284c7', border: '1px solid #0284c7', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}
              >
                View
              </button>
              {!isFav && (
                <button
                  onClick={() => onAdd(stock.symbol)}
                  style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px' }}
                >
                  <AddIcon style={{ fontSize: '12px' }} /> Add
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};