import { Navigate, useLocation } from 'react-router-dom'

const AdminAuditMallFunds: React.FC = () => {
  const location = useLocation()
  const type = new URLSearchParams(location.search).get('type')
  const query = type === 'withdraw' ? '?scope=mall&type=withdraw' : '?scope=mall&type=recharge'
  return <Navigate to={`/audit/funds${query}`} replace />
}

export default AdminAuditMallFunds
