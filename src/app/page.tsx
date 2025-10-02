'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Проверка учетных данных
    const VALID_LOGIN = 'ruslan';
    const VALID_PASSWORD = 'admin455';

    if (!login.trim() || !password.trim()) {
      setError('Заполните все поля');
      setLoading(false);
      return;
    }

    if (login !== VALID_LOGIN || password !== VALID_PASSWORD) {
      setError('Неверный логин или пароль');
      setLoading(false);
      return;
    }

    // Имитация задержки входа
    setTimeout(() => {
      // Сохраняем данные пользователя в localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify({ login }));
        localStorage.setItem('isAuthenticated', 'true');
      }
      
      // Перенаправляем на страницу Level Up
      router.push('/levelup');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-600 via-gray-700 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Блюр эффект на фоне */}
      <div className="absolute inset-0 backdrop-blur-md bg-gray-800/30"></div>
      
      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-12 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Вход в систему
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ЛОГИН
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Введите логин"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ПАРОЛЬ
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-800"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl text-white font-medium transition-all shadow-lg ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:shadow-xl'
            }`}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Level Up Trading System
          </p>
        </div>
      </div>
    </div>
  );
}