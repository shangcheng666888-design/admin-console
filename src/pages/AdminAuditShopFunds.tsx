import { Navigate, useLocation } from 'react-router-dom'

const AdminAuditShopFunds: React.FC = () => {
  const location = useLocation()
  const type = new URLSearchParams(location.search).get('type')
  const query = type === 'withdraw' ? '?scope=shop&type=withdraw' : '?scope=shop&type=recharge'
  return <Navigate to={`/audit/funds${query}`} replace />
}

export default AdminAuditShopFunds
