import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/slices/authSlice';

const StockTabs = ({ stockData }) => {
  const user = useSelector(selectCurrentUser);

  // 탭 배열 생성 - 특별회원만 AI 탭 표시
  const tabs = [
    { id: 'info', title: '기본정보', component: StockInfo },
    { id: 'chart', title: '차트', component: StockChart },
    { id: 'consensus', title: '컨센서스', component: StockConsensus },
    { id: 'broker', title: '거래원', component: StockBroker },
    { id: 'investor', title: '투자자', component: StockInvestor },
    { id: 'issue', title: '이슈', component: StockIssue },
    ...(user?.membership === 'SPECIAL'
      ? [{ id: 'ai', title: 'AI분석', component: StockAI }]
      : []),
  ];
};

export default StockTabs;
