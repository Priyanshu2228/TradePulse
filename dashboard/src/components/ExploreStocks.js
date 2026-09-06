import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import SearchIcon from '@mui/icons-material/Search';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const ExploreStocks = () => {
  const [instruments, setInstruments] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const { marketData, isConnected } = useWebSocket();
  const navigate = useNavigate();

  // Load instruments & user's watchlist
  const fetchData = async () => {
    try {
      setLoading(true);
      const [instRes, watchRes] = await Promise.all([
        api.get('/instruments'),
        api.get('/watchlist')
      ]);
      setInstruments(instRes.data || []);
      setWatchlist(watchRes.data || []);
    } catch (err) {
      console.error('Error loading explore stocks data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const favoriteSymbols = new Set(watchlist.map(item => item.symbol));

  const handleToggleFavorite = async (symbol, e) => {
    e.stopPropagation();
    try {
      if (favoriteSymbols.has(symbol)) {
        await api.post('/watchlist/remove', { symbol });
      } else {
        await api.post('/watchlist/add', { symbol });
      }
      const watchRes = await api.get('/watchlist');
      setWatchlist(watchRes.data || []);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Derive unique sectors
  const sectors = ['ALL', ...Array.from(new Set(instruments.map(i => i.sector || 'General'))).sort()];

  // Filter instruments
  const filteredInstruments = instruments.filter(inst => {
    const isFav = favoriteSymbols.has(inst.symbol);

    if (favoritesOnly && !isFav) return false;

    if (selectedType === 'EQUITY' && (inst.instrumentType === 'INDEX' || inst.type === 'INDEX')) return false;
    if (selectedType === 'INDEX' && inst.instrumentType !== 'INDEX' && inst.type !== 'INDEX') return false;

    if (selectedSector !== 'ALL' && inst.sector !== selectedSector) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const symMatch = (inst.symbol || '').toLowerCase().includes(q);
      const nameMatch = (inst.companyName || inst.name || '').toLowerCase().includes(q);
      const sectorMatch = (inst.sector || '').toLowerCase().includes(q);
      if (!symMatch && !nameMatch && !sectorMatch) return false;
    }

    return true;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        background: '#ffffff',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShowChartIcon style={{ color: '#0284c7' }} /> Explore Instruments
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Browse the complete 46 instrument universe across Indian Equities & Indices
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="badge" style={{
            background: isConnected ? '#ecfdf5' : '#fef2f2',
            color: isConnected ? '#047857' : '#b91c1c',
            border: `1px solid ${isConnected ? '#a7f3d0' : '#fecaca'}`,
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#10b981' : '#ef4444',
              marginRight: '6px'
            }}></span>
            {isConnected ? 'LIVE FEED ACTIVE' : 'RECONNECTING...'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            {filteredInstruments.length} / {instruments.length} Instruments
          </span>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '400px' }}>
          <SearchIcon style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px' }} />
          <input
            type="text"
            placeholder="Search by symbol, company name, sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
              backgroundColor: '#f8fafc'
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Asset Type Pills */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {['ALL', 'EQUITY', 'INDEX'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                style={{
                  border: 'none',
                  background: selectedType === type ? '#ffffff' : 'transparent',
                  color: selectedType === type ? '#0284c7' : '#64748b',
                  fontWeight: selectedType === type ? '700' : '500',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  boxShadow: selectedType === type ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {type === 'ALL' ? 'All Types' : type === 'EQUITY' ? 'Equities' : 'Indices'}
              </button>
            ))}
          </div>

          {/* Sector Dropdown */}
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontWeight: '500',
              color: '#334155',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">All Sectors ({sectors.length - 1})</option>
            {sectors.filter(s => s !== 'ALL').map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>

          {/* Favorites Toggle Pill */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: `1px solid ${favoritesOnly ? '#0284c7' : '#cbd5e1'}`,
              background: favoritesOnly ? '#e0f2fe' : '#ffffff',
              color: favoritesOnly ? '#0284c7' : '#475569',
              fontWeight: '600',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.15s ease'
            }}
          >
            {favoritesOnly ? <StarIcon style={{ fontSize: '18px', color: '#0284c7' }} /> : <StarBorderIcon style={{ fontSize: '18px', color: '#64748b' }} />}
            {favoritesOnly ? 'Showing Favorites' : 'Favorites Only'}
          </button>
        </div>
      </div>

      {/* Grid of Instrument Cards */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <p style={{ fontWeight: '600', fontSize: '16px' }}>Loading 46 instrument universe...</p>
        </div>
      ) : filteredInstruments.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <p style={{ fontWeight: '600', fontSize: '16px', color: '#1e293b', margin: '0 0 8px 0' }}>No instruments match your criteria</p>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Try clearing your search or sector filter to discover more stocks.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {filteredInstruments.map(inst => {
            const live = marketData[inst.symbol] || inst;
            const price = typeof live.lastPrice === 'number' ? live.lastPrice : (inst.referencePrice || 0);
            const changePct = typeof live.changePercent === 'number' ? live.changePercent : 0;
            const change = typeof live.change === 'number' ? live.change : 0;
            const isFav = favoriteSymbols.has(inst.symbol);
            const isDown = changePct < 0;
            const isIndex = inst.instrumentType === 'INDEX' || inst.type === 'INDEX';

            return (
              <div
                key={inst.symbol}
                onClick={() => navigate(`/stock/${encodeURIComponent(inst.symbol)}`)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                  e.currentTarget.style.borderColor = '#0284c7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontWeight: '700', fontSize: '16px', color: '#0f172a' }}>{inst.symbol}</span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isIndex ? '#e0f2fe' : '#f1f5f9',
                        color: isIndex ? '#0369a1' : '#475569'
                      }}>
                        {isIndex ? 'INDEX' : inst.sector || 'EQUITY'}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleToggleFavorite(inst.symbol, e)}
                      title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isFav ? '#0284c7' : '#cbd5e1',
                        transition: 'color 0.15s'
                      }}
                    >
                      {isFav ? <StarIcon style={{ fontSize: '20px' }} /> : <StarBorderIcon style={{ fontSize: '20px' }} />}
                    </button>
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inst.companyName || inst.name}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>LAST PRICE</div>
                    <div style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                      ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: '700',
                      fontSize: '13px',
                      color: isDown ? '#dc2626' : '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      justifyContent: 'flex-end'
                    }}>
                      <span>{isDown ? '' : '+'}{changePct.toFixed(2)}%</span>
                    </div>
                    <div style={{ fontSize: '11px', color: isDown ? '#f87171' : '#4ade80' }}>
                      {isDown ? '' : '+'}{change.toFixed(2)}
                    </div>
                  </div>
                </div>

                <button
                  id={`fav-btn-${inst.symbol}`}
                  onClick={(e) => handleToggleFavorite(inst.symbol, e)}
                  title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: isFav ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    background: isFav ? '#f0f9ff' : '#ffffff',
                    color: isFav ? '#0284c7' : '#475569',
                    fontWeight: '600',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isFav) {
                      e.currentTarget.style.borderColor = '#0284c7';
                      e.currentTarget.style.color = '#0284c7';
                    } else {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.borderColor = '#fecaca';
                      e.currentTarget.style.color = '#dc2626';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isFav) {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.color = '#475569';
                    } else {
                      e.currentTarget.style.background = '#f0f9ff';
                      e.currentTarget.style.borderColor = '#0284c7';
                      e.currentTarget.style.color = '#0284c7';
                    }
                  }}
                >
                  {isFav ? (
                    <>
                      <StarIcon style={{ fontSize: '16px', color: 'inherit' }} />
                      <span>★ Remove Favorite</span>
                    </>
                  ) : (
                    <>
                      <StarBorderIcon style={{ fontSize: '16px', color: 'inherit' }} />
                      <span>☆ Add to Favorites</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExploreStocks;
