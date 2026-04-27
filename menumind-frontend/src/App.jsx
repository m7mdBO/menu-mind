import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Ingredients from './pages/Ingredients';
import Suppliers from './pages/Suppliers';
import MenuItems from './pages/MenuItems';
import Sales from './pages/Sales';
import AIRestock from './pages/AIRestock';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ingredients" element={<Ingredients />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/menu-items" element={<MenuItems />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/ai-restock" element={<AIRestock />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
