import React, { useState, useRef, useMemo } from 'react';
import { 
  Home, 
  PlusCircle, 
  Plus,
  User, 
  Settings, 
  Bell, 
  Search, 
  ShieldCheck, 
  Camera, 
  Watch, 
  MapPin, 
  Clock, 
  HelpCircle,
  MoreHorizontal,
  Heart,
  MessageCircle,
  Share2, 
  TrendingUp,
  Image as ImageIcon,
  Palette,
  Info,
  Globe,
  Book,
  CalendarDays,
  Thermometer,
  CloudSun,
  Eye,
  Users,
  Lock,
  ChevronDown,
  ChevronLeft,
  Edit2,
  Check,
  X,
  Trash2,
  UserPlus,
  UserCheck,
  Sparkles,
  Flame,
  QrCode,
  Award,
  Trophy,
  ChevronRight,
  ThumbsUp,
  Send,
  Terminal,
  Cpu,
  Usb,
  Upload,
  ArrowRight,
  CalendarPlus,
  Store,
  Star,
  Map as MapIcon,
  Navigation,
  RefreshCw,
  Wind,
  Waves,
  Anchor,
  Activity
} from 'lucide-react';

// --- 고해상도 이미지 및 Mock Data ---
const IMAGE_ASSETS = {
  balicasag: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800",
  panglao: "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&q=80&w=800",
  jeju: "https://images.unsplash.com/photo-1682687982501-1e58f8139226?auto=format&fit=crop&q=80&w=800",
  pro_feed: "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&q=80&w=800",
  splash_bg: "https://images.unsplash.com/photo-1682687982501-1e58f8139226?auto=format&fit=crop&q=80&h=1600",
  default_avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
  shop1: "https://images.unsplash.com/photo-1590523265585-2479e0a6d5bb?auto=format&fit=crop&q=80&w=800",
  shop2: "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&q=80&w=800",
  maldives: "https://images.unsplash.com/photo-1518467166778-b88f373ffec7?auto=format&fit=crop&q=80&w=800",
  dahab: "https://images.unsplash.com/photo-1563823214324-4f9647253504?auto=format&fit=crop&q=80&w=800",
  raja_ampat: "https://images.unsplash.com/photo-1669041235115-4be4cc25471d?auto=format&fit=crop&q=80&w=800",
  gear_ad: "https://images.unsplash.com/photo-1590523741831-ab7e8caa0942?auto=format&fit=crop&q=80&w=800"
};

const getAvatar = (seed) => {
  const avatars = {
    'woozoo_master': 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=150',
    'DeepBlue_Pro': 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=150',
    'Felix': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'
  };
  return avatars[seed] || `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
};

const MOCK_LOGS = [
  { 
    id: 128, country: '필리핀', location: '보홀', point: '블랙 포레스트', date: '2026.03.28', startTime: '10:15', endTime: '11:03',
    depth: '24.5', avgDepth: '16.2', time: '48', waterTemp: '28', visibility: '15', weather: '☀️ 맑음',
    equipment: ['컽 만티스 LV', '오즈모액션6', '걸 뮤 핀', '웻슈트 3mm'], buddy: ['woozoo_master'],
    memo: '거대한 잭피쉬 스쿨링을 만났다! 조류가 약간 있었지만 환상적인 다이빙.', img: IMAGE_ASSETS.balicasag 
  },
  { 
    id: 127, country: '한국', location: '제주도 서귀포', point: '문섬 새끼섬', date: '2026.02.15', startTime: '09:30', endTime: '10:11',
    depth: '21.0', avgDepth: '14.5', time: '41', waterTemp: '16', visibility: '8', weather: '☁️ 구름',
    equipment: ['드라이슈트 5mm', '걸 만티스'], buddy: ['박혜양'],
    memo: '연산호 군락이 정말 화려하다. 겨울 제주 바다의 차갑지만 선명한 매력.', img: IMAGE_ASSETS.jeju 
  },
  { 
    id: 126, country: '이집트', location: '다합', point: '블루홀', date: '2025.12.24', startTime: '14:00', endTime: '14:45',
    depth: '30.0', avgDepth: '18.2', time: '45', waterTemp: '24', visibility: '30', weather: '☀️ 맑음',
    equipment: ['웻슈트 3mm', '가민 G1', '에이펙스 호흡기'], buddy: ['OceanLover'],
    memo: '말 그대로 끝없는 푸른 구멍. 시야가 너무 좋아서 수심 감각이 무뎌질 정도.', img: IMAGE_ASSETS.dahab 
  },
  { 
    id: 125, country: '인도네시아', location: '라자암팟', point: '만타 샌디', date: '2025.11.10', startTime: '11:20', endTime: '12:15',
    depth: '18.5', avgDepth: '12.0', time: '55', waterTemp: '29', visibility: '20', weather: '⛅ 구름',
    equipment: ['웻슈트 2mm', '걸 뮤 핀', '아쿠아렁 BCD'], buddy: ['DeepBlue_Pro'],
    memo: '블랙 만타가 내 머리 바로 위를 지나갔다! 전율이 돋는 순간.', img: IMAGE_ASSETS.raja_ampat 
  },
  { 
    id: 124, country: '몰디브', location: '아리 아톨', point: '마야 틸라', date: '2025.09.05', startTime: '19:45', endTime: '20:30',
    depth: '22.0', avgDepth: '15.5', time: '45', waterTemp: '28', visibility: '15', weather: '🌙 밤',
    equipment: ['웻슈트 3mm', '나이트 다이빙 라이트'], buddy: ['woozoo_master', '박혜양'],
    memo: '첫 나이트 다이빙! 사냥하는 화이트팁 상어들이 정말 역동적이었다.', img: IMAGE_ASSETS.maldives 
  }
];

const MOCK_FEEDS = [
  { id: 'f1', author: 'woozoo_master', time: '30분 전', location: '제주도 서귀포', img: IMAGE_ASSETS.jeju, content: '시야 20m 터졌네요. 🌸', likes: 124, comments: 12, isFollowing: true, type: 'normal' },
  { id: 'f2', author: 'DeepBlue_Pro', time: '2시간 전', location: '인도네시아 라자암팟', img: IMAGE_ASSETS.pro_feed, content: '만타가오리와의 조우! 🦈', likes: 856, comments: 45, isFollowing: false, type: 'trending' },
  { id: 'f4', author: '스쿠버프로 코리아', time: '1일 전', location: '장비 프로모션', img: IMAGE_ASSETS.gear_ad, content: '🔥 2026년 신형 BCD 출시!', likes: 1205, comments: 88, isFollowing: false, type: 'ad' }
];

const MOCK_SHOPS = [
  { id: 's1', name: '오션홀릭 다이브', country: '필리핀', city: '보홀', region: '팡라오', rating: 4.8, reviewCount: 124, img: IMAGE_ASSETS.shop1, desc: '보홀 최고의 펀다이빙 & PADI 교육 센터.' },
  { id: 's2', name: '블루라군 다이브', country: '한국', city: '제주', region: '서귀포', rating: 4.9, reviewCount: 89, img: IMAGE_ASSETS.shop2, desc: '사계절 내내 아름다운 제주 바다.' },
  { id: 's3', name: '디퍼 다이브', country: '필리핀', city: '보홀', region: '팡라오', rating: 4.7, reviewCount: 210, img: IMAGE_ASSETS.balicasag, desc: '거북이와 함께하는 즐거운 다이빙.' }
];

// --- 서브 컴포넌트 ---
const StatBox = ({ label, value, unit, highlighted, icon }) => (
  <div className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${highlighted ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-gray-100 text-gray-900 shadow-sm'}`}>
    <span className={`text-[9px] font-black uppercase mb-1 flex items-center gap-1 ${highlighted ? 'text-blue-100' : 'text-gray-400'}`}>
      {icon} {label}
    </span>
    <span className="text-base font-black leading-none">{value}<span className="text-[10px] font-normal ml-0.5">{unit}</span></span>
  </div>
);

const NavItem = ({ icon, label, isActive, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-[60px] h-12 rounded-2xl transition-all duration-300 ${isActive ? 'text-blue-600 bg-blue-50/80 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
    {React.cloneElement(icon, { className: `transition-all duration-300 ${isActive ? 'scale-110 stroke-[2.5px]' : 'scale-100 stroke-2'}`, size: 20 })}
    <span className={`text-[9px] mt-1 transition-all duration-300 ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
  </button>
);

// --- 화면 컴포넌트 ---
const HomeDashboardTab = ({ onOpenShopSearch }) => (
  <div className="p-5 animate-fade-in pb-20 h-full overflow-y-auto bg-gray-50/20">
    <h2 className="text-2xl font-black text-gray-900 mb-1 leading-tight">안녕하세요, 김다이버님! 🌊</h2>
    <p className="text-sm text-gray-500 mb-8 px-1">기록하고 싶은 바다를 다이브로그와 함께하세요.</p>
    
    <div className="mb-8" onClick={onOpenShopSearch}>
       <div className="bg-gray-900 text-white p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between border border-white/10 transition-all cursor-pointer hover:bg-black relative overflow-hidden">
         <div className="absolute -right-2 -bottom-2 opacity-10"><MapIcon size={120}/></div>
         <div className="flex items-center gap-4 relative z-10">
           <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg"><MapIcon size={28}/></div>
           <div><h3 className="font-black text-base">지도에서 샵 찾기</h3><p className="text-[10px] text-blue-400 font-bold mt-0.5 tracking-wider uppercase">Find Dive Centers</p></div>
         </div>
         <Navigation size={22} className="text-gray-500"/>
       </div>
    </div>

    <div className="mb-8">
      <div className="flex justify-between items-center mb-3 px-1"><h3 className="font-black text-gray-900">다가오는 다이빙</h3><button className="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 flex items-center gap-1"><CalendarPlus size={12}/> 일정 추가</button></div>
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 opacity-10 transition-transform group-hover:scale-110 duration-700"><Globe size={100}/></div>
        <div className="relative z-10"><span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-black mb-2 inline-block uppercase tracking-wider shadow-sm">D-7</span><h3 className="text-xl font-black mb-4 tracking-tight">필리핀 보홀 투어</h3><div className="space-y-1.5 text-xs opacity-90"><p className="flex items-center gap-2"><Clock size={14} className="opacity-70"/> 2026.04.13 ~ 04.17</p><p className="flex items-center gap-2"><Store size={14} className="opacity-70"/> 오션홀릭 다이브</p></div></div>
      </div>
    </div>

    <h3 className="font-black text-gray-900 mb-3 px-1">내 활동 요약</h3>
    <div className="grid grid-cols-2 gap-4">
       <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center"><Award size={24} className="text-purple-500 mb-2"/><p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Best Gear</p><h4 className="font-black text-sm">오즈모액션6</h4></div>
       <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center"><Trophy size={24} className="text-amber-500 mb-2"/><p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Best Buddy</p><h4 className="font-black text-sm truncate w-full text-center px-2">woozoo_master</h4></div>
    </div>
  </div>
);

const ShopSearchView = ({ onBack, onShopSelect }) => {
  const [filters, setFilters] = useState({ country: 'all', city: 'all', region: 'all' });
  const [isSearching, setIsSearching] = useState(false);
  const [isMapDriven, setIsMapDriven] = useState(false);

  const countries = [...new Set(MOCK_SHOPS.map(s => s.country))];
  const cities = filters.country === 'all' ? [] : [...new Set(MOCK_SHOPS.filter(s => s.country === filters.country).map(s => s.city))];
  const regions = filters.city === 'all' ? [] : [...new Set(MOCK_SHOPS.filter(s => s.city === filters.city).map(s => s.region))];
  const isRegionSelected = filters.region !== 'all';

  const processedShops = useMemo(() => {
    let res = MOCK_SHOPS.filter(s => (filters.country==='all'||s.country===filters.country)&&(filters.region==='all'||s.region===filters.region));
    if (isMapDriven) res = [...res].reverse();
    return res;
  }, [filters, isMapDriven]);

  const mapSrc = useMemo(() => {
    const q = isRegionSelected ? `${filters.region} ${filters.city} 다이빙` : filters.country!=='all' ? `${filters.country} 다이빙` : "유명 다이빙 샵";
    const z = isRegionSelected ? 13 : filters.country!=='all' ? 8 : 2;
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=${z}&ie=UTF8&iwloc=&output=embed`;
  }, [filters, isRegionSelected]);

  return (
    <div className="animate-fade-in bg-gray-50 min-h-full h-full flex flex-col relative z-20">
      <div className="shrink-0 bg-white/95 backdrop-blur-md px-5 py-4 flex justify-between items-center z-30 shadow-sm border-b border-gray-100">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ChevronLeft size={24} /></button>
        <span className="font-black text-base text-gray-900 tracking-tight uppercase">Shop Explorer</span>
        <div className="w-10"></div>
      </div>
      <div className="shrink-0 h-64 bg-gray-200 border-b border-gray-200 relative">
        <iframe title="map" width="100%" height="100%" frameBorder="0" src={mapSrc} className={`transition-opacity duration-500 ${isSearching?'opacity-30':'opacity-100'}`}/>
        {isRegionSelected && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
             <button onClick={()=>{setIsSearching(true); setTimeout(()=>{setIsSearching(false); setIsMapDriven(true)}, 800)}} className="bg-white text-blue-600 px-4 py-2 rounded-full font-black text-xs shadow-2xl flex items-center gap-2 border border-blue-50 active:scale-95 transition-all">
               {isSearching ? <RefreshCw size={14} className="animate-spin"/> : <MapIcon size={14}/>} 이 지역에서 재검색
             </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-6 flex flex-col gap-2">
          <div className="flex gap-2">
            <select value={filters.country} onChange={(e)=>setFilters({country:e.target.value, city:'all', region:'all'})} className="flex-1 bg-gray-50 border-none rounded-xl p-3 text-xs font-bold appearance-none text-center outline-none">
               <option value="all">국가 선택</option>{countries.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.city} onChange={(e)=>setFilters({...filters, city:e.target.value, region:'all'})} disabled={filters.country==='all'} className="flex-1 bg-gray-50 border-none rounded-xl p-3 text-xs font-bold appearance-none text-center outline-none">
               <option value="all">도시 선택</option>{cities.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <select value={filters.region} onChange={(e)=>setFilters({...filters, region:e.target.value})} disabled={filters.city==='all'} className="w-full bg-blue-50 text-blue-700 border-none rounded-xl p-3 text-xs font-black appearance-none text-center outline-none">
             <option value="all">상세 지역 선택</option>{regions.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="space-y-4">
           {processedShops.map(s=>(<div key={s.id} onClick={()=>onShopSelect(s)} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex gap-4 cursor-pointer active:scale-95 transition-all"><img src={s.img} className="w-20 h-20 rounded-2xl object-cover shrink-0"/><div className="flex-1 py-1"><h4 className="font-black text-gray-900 mb-1 truncate">{s.name}</h4><p className="text-[10px] text-gray-400 flex items-center gap-1 mb-2"><MapPin size={10} className="text-blue-500"/> {s.city}, {s.region}</p><div className="flex gap-2"><span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">예약가능</span><span className="text-[10px] font-bold text-gray-400 border border-gray-200 px-2 py-0.5 rounded">리뷰 {s.reviewCount}</span></div></div></div>))}
        </div>
      </div>
    </div>
  );
};

const LogDetailView = ({ log, onBack }) => (
  <div className="animate-fade-in h-full bg-gray-50 relative z-50 overflow-y-auto pb-32">
    <div className="sticky top-0 bg-white/90 backdrop-blur-md px-5 py-4 flex justify-between items-center z-50 border-b border-gray-100">
      <button onClick={onBack} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ChevronLeft size={24}/></button>
      <div className="flex gap-2"><button className="p-2 bg-gray-50 rounded-full text-gray-600"><Share2 size={18}/></button><button className="p-2 bg-blue-50 rounded-full text-blue-600"><Edit2 size={18}/></button></div>
    </div>
    <div className="p-5">
      <div className="flex justify-between items-start mb-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{log.date} • {log.startTime} IN</p><span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg shadow-blue-200">LOG #{log.id}</span></div>
      <h2 className="text-3xl font-black text-gray-900 tracking-tight">{log.country} {log.location}</h2>
      <p className="text-lg font-bold text-blue-600 flex items-center gap-1.5 mt-1 mb-6"><Anchor size={18}/> {log.point}</p>
      <div className="relative aspect-square rounded-[3rem] overflow-hidden shadow-2xl mb-8 border-4 border-white group"><img src={log.img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="dive"/><div className="absolute top-6 left-6 bg-blue-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 shadow-lg border border-white/20"><ShieldCheck size={14}/> Verified Data</div><div className="absolute bottom-6 left-6 flex gap-2"><div className="bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 shadow-lg border border-white/10"><CloudSun size={14}/> {log.weather}</div></div></div>
      <div className="grid grid-cols-4 gap-2 mb-8">
         <StatBox label="Depth" value={log.depth} unit="m" icon={<Navigation size={10}/>} />
         <StatBox label="Time" value={log.time} unit="min" highlighted icon={<Clock size={10}/>} />
         <StatBox label="Temp" value={log.waterTemp} unit="°C" icon={<Thermometer size={10}/>} />
         <StatBox label="Vis" value={log.visibility} unit="m" icon={<Eye size={10}/>} />
      </div>
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm mb-6 flex justify-between items-center">
         <div className="text-center"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Time In/Out</p><p className="text-sm font-bold text-gray-800">{log.startTime} - {log.endTime}</p></div>
         <div className="w-[1px] h-8 bg-gray-100"></div>
         <div className="text-center"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Avg. Depth</p><p className="text-sm font-bold text-gray-800">{log.avgDepth}m</p></div>
         <div className="w-[1px] h-8 bg-gray-100"></div>
         <div className="text-center"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Device</p><p className="text-xs font-black text-blue-600">Computer</p></div>
      </div>
      <div className="bg-gray-900 text-white rounded-[2.5rem] p-7 shadow-xl border border-white/10 mb-8 relative overflow-hidden"><div className="absolute top-0 right-0 p-6 opacity-10"><MessageCircle size={80}/></div><h3 className="text-xs font-black text-blue-400 uppercase mb-4 tracking-widest flex items-center gap-2 relative z-10"><Edit2 size={14}/> Dive Diary</h3><p className="text-sm leading-relaxed opacity-90 italic relative z-10">"{log.memo}"</p></div>
      <div className="space-y-4">
         <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm"><h3 className="text-xs font-black text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Users size={14}/> Dive Buddy</h3><div className="flex gap-2 flex-wrap">{log.buddy.map(b => (<span key={b} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-xs font-black border border-blue-100 flex items-center gap-1.5"><UserCheck size={12}/> {b}</span>))}</div></div>
         <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm"><h3 className="text-xs font-black text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Palette size={14}/> Equipment Used</h3><div className="flex gap-2 flex-wrap">{log.equipment.map(e => (<span key={e} className="bg-gray-50 text-gray-500 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-gray-100">{e}</span>))}</div></div>
      </div>
    </div>
  </div>
);

const LogbookTab = ({ onSelectLog }) => (
  <div className="p-5 animate-fade-in h-full overflow-y-auto pb-24 bg-gray-50/10">
    <div className="flex justify-between items-center mb-6 px-1"><h2 className="text-2xl font-black text-gray-900 tracking-tight">내 로그북</h2><div className="bg-blue-50 text-blue-600 p-2 rounded-xl border border-blue-100 shadow-sm"><Activity size={18}/></div></div>
    <div className="grid grid-cols-1 gap-4">
      {MOCK_LOGS.map(log => (
        <div key={log.id} onClick={() => onSelectLog(log)} className="bg-white p-4 rounded-[2.2rem] shadow-sm border border-gray-100 flex gap-4 items-center cursor-pointer active:scale-95 transition-all hover:shadow-md">
          <div className="w-20 h-20 rounded-[1.5rem] overflow-hidden shadow-inner shrink-0 border border-gray-50"><img src={log.img} className="w-full h-full object-cover" alt="thumb"/></div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1"><span className="text-[10px] text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">#{log.id}</span><span className="text-[10px] text-gray-400 font-bold">{log.date}</span></div>
            <h4 className="font-black text-gray-900 truncate mb-1">{log.location}</h4>
            <div className="flex gap-3 text-[10px] text-gray-400 font-bold uppercase tracking-tighter"><span className="flex items-center gap-1 text-gray-600"><Navigation size={10}/> {log.depth}m</span><span className="flex items-center gap-1 text-gray-600"><Clock size={10}/> {log.time}분</span></div>
          </div>
          <ChevronRight size={16} className="text-gray-300 mr-1"/>
        </div>
      ))}
    </div>
  </div>
);

const CreateLogTab = ({ onCancel }) => {
  const [isSynced, setIsSynced] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [formData, setFormData] = useState({ date: '2026-03-30', startTime: '10:15', endTime: '11:03', diveTime: '', maxDepth: '', avgDepth: '', waterTemp: '', visibility: '', weather: '☀️ 맑음', country: '', location: '', point: '', equipment: '', buddy: '', memo: '' });
  const simulate = async () => {
    setIsParsing(true);
    setLogs(["[INFO] Loading libdivecomputer.wasm...", "[USB] Device connected: 0x5357", "[PARSE] Extracted 1 dives.", "[INFO] Success."]);
    await new Promise(r => setTimeout(r, 1500)); setIsSynced(true); setIsParsing(false);
    setFormData({ ...formData, date: '2026-03-28', startTime: '10:15', endTime: '11:03', diveTime: '48', maxDepth: '24.5', avgDepth: '16.2', waterTemp: '28', visibility: '15', country: '필리핀', location: '보홀', point: '블랙 포레스트' });
  };
  return (
    <div className="p-5 animate-fade-in pb-24 h-full overflow-y-auto bg-gray-50/50">
      <div className="flex justify-between items-center mb-6 px-1"><h2 className="text-2xl font-black text-gray-900">새 로그 기록</h2><button onClick={onCancel} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button></div>
      <div className="space-y-4">
        <div className="bg-gray-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">{!isSynced && !isParsing && (<button onClick={simulate} className="w-full py-4 bg-blue-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-500 transition-all active:scale-95 shadow-lg">기기 연결 및 바이너리 파싱</button>)} {isParsing && (<div className="bg-black/50 rounded-2xl p-4 font-mono text-[10px] text-green-400 h-24 overflow-y-auto border border-white/10">{logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}</div>)} {isSynced && (<div className="bg-green-500/20 border border-green-500/50 rounded-2xl p-4 flex items-center gap-3"><ShieldCheck className="text-green-400" /><div><p className="text-xs font-black text-green-400 uppercase tracking-widest">Shearwater Connected</p></div></div>)}</div>
        <div className={`space-y-6 transition-opacity ${isParsing ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}><div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100"><h3 className="text-xs font-black text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Clock size={14}/> Dive Data</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-gray-500 mb-1 block">입수 시간</label><input type="time" value={formData.startTime} className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm" /></div><div><label className="text-[10px] font-bold text-gray-500 mb-1 block">출수 시간</label><input type="time" value={formData.endTime} className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm" /></div></div></div><div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100"><h3 className="text-xs font-black text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><MapPin size={14}/> Location</h3><div className="space-y-4"><div><label className="text-[10px] font-bold text-gray-500 mb-1 block">국가</label><input type="text" value={formData.country} className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm" /></div><div><label className="text-[10px] font-bold text-gray-500 mb-1 block">포인트명</label><input type="text" value={formData.point} className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm" /></div></div></div><button className="w-full py-5 bg-gray-900 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-transform">기록 저장하기</button></div>
      </div>
    </div>
  );
};

// --- 메인 앱 ---
export default function App() {
  const [authState, setAuthState] = useState('authenticated'); 
  const [activeTab, setActiveTab] = useState('logbook'); 
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isShopSearchOpen, setIsShopSearchOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null); 
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedQna, setSelectedQna] = useState(null); 

  if (authState === 'login') return <LoginScreen onLogin={() => setAuthState('onboarding')} />;
  if (authState === 'onboarding') return <OnboardingScreen onComplete={() => setAuthState('authenticated')} />;

  const isMainContent = !selectedShop && !selectedLog && !selectedQna && !isShopSearchOpen && activeTab !== 'create_feed';

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900 font-sans text-gray-900">
      <div className="w-full max-w-md h-[850px] bg-gray-50 flex flex-col relative overflow-hidden shadow-2xl">
        
        {isMainContent && (
          <header className="px-5 py-4 bg-white flex justify-between items-center sticky top-0 z-20 shadow-sm border-b border-gray-50">
            <h1 className="text-xl font-black tracking-tighter text-blue-600 uppercase">Dive<span className="text-gray-900">Log</span></h1>
            <div className="flex gap-3 text-gray-600"><Search size={22} className="cursor-pointer hover:text-blue-600 transition-colors" /><Bell size={22} className="cursor-pointer hover:text-blue-600 transition-colors" /></div>
          </header>
        )}

        <main className="flex-1 overflow-hidden relative">
          {selectedShop ? (
            <div className="animate-fade-in bg-white h-full overflow-y-auto pb-32 relative z-30"><div className="sticky top-0 bg-white/80 backdrop-blur-md px-5 py-4 flex justify-between items-center z-20"><button onClick={()=>setSelectedShop(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ChevronLeft size={24} /></button><Heart size={24} className="text-gray-300 hover:text-red-500 cursor-pointer transition-colors" /></div><img src={selectedShop.img} className="w-full h-64 object-cover -mt-16"/><div className="p-6"><div className="flex justify-between items-start mb-2"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">Verified Shop</span><div className="flex items-center gap-1 font-black text-sm text-gray-900"><Star size={14} className="fill-amber-400 text-amber-400"/> {selectedShop.rating}</div></div><h2 className="text-2xl font-black text-gray-900 mb-3">{selectedShop.name}</h2><p className="text-sm text-gray-500 leading-relaxed mb-8">{selectedShop.desc}</p><div className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-100 shadow-sm"><div className="flex items-center gap-2 mb-6"><CalendarDays className="text-blue-600" size={20}/> <h4 className="font-black text-gray-900">투어 예약 현황</h4></div><div className="grid grid-cols-7 gap-1 mb-8">{['일','월','화','수','목','금','토'].map(d=><div key={d} className="text-center text-[10px] font-black text-gray-400">{d}</div>)}{Array.from({length: 30}, (_,i)=>(<div key={i} className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold border ${i+1===15 ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'text-gray-600 border-transparent hover:bg-gray-200 cursor-pointer'}`}>{i+1}</div>))}</div><button className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-transform hover:bg-black">예약 문의 남기기</button></div></div></div>
          ) : isShopSearchOpen ? (
            <ShopSearchView onBack={() => setIsShopSearchOpen(false)} onShopSelect={setSelectedShop} />
          ) : selectedLog ? (
            <LogDetailView log={selectedLog} onBack={() => setSelectedLog(null)} />
          ) : selectedQna ? (
            <div className="p-5 animate-fade-in h-full bg-white relative z-50"><button onClick={()=>setSelectedQna(null)} className="p-2 bg-gray-50 rounded-full mb-4"><ChevronLeft size={24}/></button><h2 className="text-2xl font-black mb-4">{selectedQna.title}</h2><div className="bg-blue-50 p-6 rounded-3xl text-blue-900 text-sm leading-relaxed">{selectedQna.content}</div></div>
          ) : (
            <div className="h-full overflow-hidden">
              {activeTab === 'home' && <HomeDashboardTab onOpenShopSearch={() => setIsShopSearchOpen(true)} />}
              {activeTab === 'feed' && <div className="p-5 animate-fade-in pb-24 h-full overflow-y-auto bg-gray-50/10"><h3 className="text-xl font-black text-gray-900 mb-6 px-1 flex justify-between items-center">실시간 피드 <Bell size={20} className="text-gray-400"/></h3><div className="space-y-8">{MOCK_FEEDS.map(f => (<div key={f.id} className="bg-white rounded-[2.5rem] p-4 shadow-sm border border-gray-100 group relative overflow-hidden">{f.type === 'ad' && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl z-10 shadow-sm">SPONSORED</div>}<div className="flex items-center gap-3 mb-4 px-1"><div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-md"><img src={getAvatar(f.author)} className="w-full h-full object-cover" alt="av"/></div><div><h4 className="text-sm font-black text-gray-900">{f.author}</h4><p className="text-[10px] text-gray-400 font-bold">{f.time} • {f.location}</p></div></div><div className="relative aspect-square rounded-[2rem] overflow-hidden mb-4 shadow-inner bg-gray-50"><img src={f.img} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" alt="feed"/></div><div className="px-2 pb-1"><div className="flex gap-4 mb-3"><Heart size={22} className="text-gray-800 hover:text-red-500 transition-colors"/><MessageCircle size={22} className="text-gray-800"/><Share2 size={22} className="text-gray-800"/></div><p className="text-sm leading-relaxed text-gray-800"><span className="font-black mr-2">{f.author}</span>{f.content}</p></div></div>))}</div></div>}
              {activeTab === 'log' && <CreateLogTab onCancel={() => setActiveTab('logbook')} />}
              {activeTab === 'create_feed' && <div className="p-10 text-center flex flex-col items-center justify-center h-full"><ImageIcon size={64} className="text-teal-400 mb-6"/><h2 className="text-2xl font-black">피드 작성 페이지 준비 중</h2><button onClick={()=>setActiveTab('feed')} className="mt-8 text-blue-600 font-black">뒤로가기</button></div>}
              {activeTab === 'logbook' && <LogbookTab onSelectLog={setSelectedLog} />}
              {activeTab === 'profile' && <div className="animate-fade-in h-full overflow-y-auto pb-24 bg-gray-50/30"><div className="bg-white p-6 pt-12 rounded-b-[4rem] shadow-sm mb-6 flex flex-col items-center border-b border-gray-50"><div className="w-24 h-24 rounded-full border-4 border-white shadow-2xl overflow-hidden mb-5 relative group cursor-pointer transition-transform hover:scale-105"><img src={getAvatar('Felix')} className="w-full h-full object-cover"/><div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={20} className="text-white"/></div></div><h2 className="text-2xl font-black text-gray-900 tracking-tight">김다이버</h2><p className="text-sm text-gray-400 font-black mb-8 uppercase tracking-widest border border-gray-100 px-3 py-1 rounded-full">PADI • Advanced Open Water</p><div className="grid grid-cols-3 gap-3 w-full px-2"><StatBox label="로그" value="128" unit="회" icon={<Book size={10}/>} /><StatBox label="인증" value="112" unit="회" highlighted icon={<ShieldCheck size={10}/>} /><StatBox label="시간" value="92" unit="hr" icon={<Clock size={10}/>} /></div></div><div className="px-6 space-y-6"><h3 className="font-black mb-1 flex items-center gap-2 text-gray-900 uppercase text-xs tracking-widest text-gray-400">Analysis Stats</h3><div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm"><div className="flex justify-between items-center mb-4"><span className="text-xs font-black text-gray-500 uppercase tracking-widest">Global Activity</span><span className="text-xs font-black text-blue-600">필리핀 65%</span></div><div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex shadow-inner"><div className="bg-blue-500 h-full shadow-lg" style={{width:'65%'}}></div><div className="bg-teal-400 h-full" style={{width:'25%'}}></div><div className="bg-gray-300 h-full" style={{width:'10%'}}></div></div></div></div></div>}
            </div>
          )}
        </main>

        {isMainContent && (
          <>
            {isPlusMenuOpen && (
              <div className="absolute inset-0 z-40 flex flex-col justify-end items-center pb-[120px]">
                <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsPlusMenuOpen(false)}></div>
                <div className="relative bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white p-2.5 w-56 animate-fade-in flex flex-col gap-1 z-50">
                  <button onClick={() => { setActiveTab('log'); setIsPlusMenuOpen(false); }} className="w-full flex items-center gap-3.5 p-3.5 hover:bg-gray-50/80 rounded-[1.8rem] transition-all group">
                    <div className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><Book size={18} strokeWidth={2.5}/></div>
                    <div className="flex flex-col items-start text-left"><span className="font-black text-sm text-gray-900">다이빙 로그 기록</span><span className="text-[10px] text-gray-500 font-bold">상세 데이터 입력</span></div>
                  </button>
                  <button onClick={() => { setActiveTab('create_feed'); setIsPlusMenuOpen(false); }} className="w-full flex items-center gap-3.5 p-3.5 hover:bg-gray-50/80 rounded-[1.8rem] transition-all group">
                    <div className="bg-teal-50 text-teal-600 p-2.5 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><ImageIcon size={18} strokeWidth={2.5}/></div>
                    <div className="flex flex-col items-start text-left"><span className="font-black text-sm text-gray-900">일상 피드 공유</span><span className="text-[10px] text-gray-500 font-bold">사진 및 짧은 글</span></div>
                  </button>
                </div>
              </div>
            )}
            <nav className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[92%] bg-white/80 backdrop-blur-xl rounded-[2.5rem] flex justify-between items-center px-2 py-2.5 shadow-xl border border-white z-30">
              <NavItem icon={<Home />} label="홈" isActive={activeTab === 'home'} onClick={() => { setActiveTab('home'); setIsPlusMenuOpen(false); }} />
              <NavItem icon={<Globe />} label="피드" isActive={activeTab === 'feed'} onClick={() => { setActiveTab('feed'); setIsPlusMenuOpen(false); }} />
              <div className="w-[64px] flex-shrink-0"></div>
              <NavItem icon={<Book />} label="로그북" isActive={activeTab === 'logbook'} onClick={() => { setActiveTab('logbook'); setIsPlusMenuOpen(false); }} />
              <NavItem icon={<User />} label="프로필" isActive={activeTab === 'profile'} onClick={() => { setActiveTab('profile'); setIsPlusMenuOpen(false); }} />
            </nav>
            <div className="absolute bottom-[34px] left-1/2 transform -translate-x-1/2 z-50">
              <div className="bg-gray-50/50 rounded-full p-2.5 backdrop-blur-md shadow-sm border border-white/60">
                <button onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)} className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transform transition-all duration-500 active:scale-90 ${isPlusMenuOpen ? 'bg-gray-800 text-white rotate-[135deg] shadow-gray-900/30' : 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/40'}`}><Plus size={30} strokeWidth={2.5} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}