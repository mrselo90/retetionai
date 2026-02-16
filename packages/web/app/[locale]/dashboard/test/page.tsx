'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ScheduledTask {
  id: string;
  user_id: string;
  order_id?: string;
  task_type: string;
  execute_at: string;
  status: string;
  created_at: string;
}

interface SystemHealth {
  database: {
    orders: number;
    users: number;
    conversations: number;
    products: number;
  };
  queues: {
    redis: string;
  };
  tasks: {
    pending: number;
    completed: number;
    failed: number;
  };
  openai?: {
    configured: boolean;
    status: 'ok' | 'missing' | 'placeholder' | 'invalid' | 'error';
    message?: string;
    verified?: boolean;
  };
}

export default function TestInterfacePage() {
  const [activeTab, setActiveTab] = useState<'events' | 'whatsapp' | 'rag' | 'tasks' | 'health'>('events');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Event simulation state
  const [eventType, setEventType] = useState('order_delivered');
  const [externalOrderId, setExternalOrderId] = useState('TEST-ORD-001');
  const [customerPhone, setCustomerPhone] = useState('+905551234567');
  const [customerName, setCustomerName] = useState('Test Kullanıcı');
  const [orderStatus, setOrderStatus] = useState('delivered');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);

  // WhatsApp simulation state
  const [whatsappPhone, setWhatsappPhone] = useState('+905551234567');
  const [whatsappMessage, setWhatsappMessage] = useState('Bu ürünü nasıl kullanmalıyım?');

  // RAG test state
  const [ragQuery, setRagQuery] = useState('Bu ürün nasıl kullanılır?');
  const [ragProductIds, setRagProductIds] = useState('');

  // Tasks state
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'tasks') {
      loadTasks();
    } else if (activeTab === 'health') {
      loadHealth();
    }
  }, [activeTab]);

  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const response = await authenticatedRequest<{ tasks: ScheduledTask[] }>(
          '/api/test/tasks',
          session.access_token
        );
        setTasks(response.tasks ?? []);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
      toast.error('Görevler yüklenemedi');
    } finally {
      setTasksLoading(false);
    }
  };

  const loadHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const response = await authenticatedRequest<SystemHealth>(
          '/api/test/health',
          session.access_token
        );
        setHealth(response);
      }
    } catch (err: any) {
      console.error('Failed to load health:', err);
      setHealthError(err?.message ?? 'System health yüklenemedi');
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleMockEvent = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setLoading(true);
      setResult(null);

      const response = await authenticatedRequest(
        '/api/test/events',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            event_type: eventType,
            external_order_id: externalOrderId,
            customer_phone: customerPhone,
            customer_name: customerName,
            order_status: orderStatus,
            delivery_date: deliveryDate,
            products: [
              {
                external_product_id: 'PROD-001',
                name: 'Test Ürün',
                url: 'https://example.com/product',
              },
            ],
          }),
        }
      );

      setResult(response);
    } catch (err: any) {
      console.error('Mock event error:', err);
      setResult({ error: err.message || 'Event simülasyonu başarısız' });
    } finally {
      setLoading(false);
    }
  };

  const handleMockWhatsApp = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setLoading(true);
      setResult(null);

      const response = await authenticatedRequest(
        '/api/test/whatsapp',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            phone: whatsappPhone,
            message: whatsappMessage,
          }),
        }
      );

      setResult(response);
    } catch (err: any) {
      console.error('Mock WhatsApp error:', err);
      setResult({ error: err.message || 'WhatsApp simülasyonu başarısız' });
    } finally {
      setLoading(false);
    }
  };

  const getRAGBody = () => ({
    query: ragQuery,
    productIds: ragProductIds
      ? ragProductIds.split(',').map((id) => id.trim()).filter(Boolean)
      : undefined,
    topK: 5,
  });

  const handleRAGTest = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setLoading(true);
      setResult(null);

      const response = await authenticatedRequest(
        '/api/test/rag',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify(getRAGBody()),
        }
      );

      setResult(response);
    } catch (err: any) {
      console.error('RAG test error:', err);
      setResult({ error: err.message || 'RAG testi başarısız' });
    } finally {
      setLoading(false);
    }
  };

  const handleRAGAnswer = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setLoading(true);
      setResult(null);

      const response = await authenticatedRequest(
        '/api/test/rag/answer',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify(getRAGBody()),
        }
      );

      setResult(response);
    } catch (err: any) {
      console.error('RAG + AI error:', err);
      setResult({ error: err.message || 'RAG + AI cevabı alınamadı' });
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerTask = async (taskId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest(
        `/api/test/tasks/${taskId}/trigger`,
        session.access_token,
        {
          method: 'POST',
        }
      );

      toast.success('Task tetiklendi', 'Worker kısa süre içinde işleyecek.');
      await loadTasks();
    } catch (err: any) {
      console.error('Trigger task error:', err);
      toast.error('Task tetiklenemedi', err?.message);
    }
  };

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Test & Development Interface</h1>
          <p className="mt-2 text-zinc-600">Sistem bileşenlerini test edin</p>
        </div>

        {/* Tabs - scroll on small screens */}
        <div className="border-b border-zinc-200 overflow-x-auto">
          <nav className="flex space-x-8 min-w-max px-1" aria-label="Test sections">
            {(['events', 'whatsapp', 'rag', 'tasks', 'health'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                aria-selected={activeTab === tab}
                aria-controls={`panel-${tab}`}
                id={`tab-${tab}`}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-t ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                }`}
              >
                {tab === 'events' && '📦 Mock Events'}
                {tab === 'whatsapp' && '💬 WhatsApp Sim'}
                {tab === 'rag' && '🔍 RAG Test'}
                {tab === 'tasks' && '⏰ Scheduled Tasks'}
                {tab === 'health' && '💚 System Health'}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {/* Mock Events Tab */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-zinc-900">Mock Event Simülatörü</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label block mb-2">
                    Event Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="order_created">order_created</option>
                    <option value="order_delivered">order_delivered</option>
                    <option value="order_cancelled">order_cancelled</option>
                    <option value="order_returned">order_returned</option>
                  </select>
                </div>
                <div>
                  <label className="form-label block mb-2">
                    External Order ID
                  </label>
                  <input
                    type="text"
                    value={externalOrderId}
                    onChange={(e) => setExternalOrderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="form-label block mb-2">
                    Customer Phone
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+905551234567"
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="form-label block mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="form-label block mb-2">
                    Order Status
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="created">created</option>
                    <option value="delivered">delivered</option>
                    <option value="cancelled">cancelled</option>
                    <option value="returned">returned</option>
                  </select>
                </div>
                <div>
                  <label className="form-label block mb-2">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleMockEvent}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading ? 'İşleniyor...' : 'Event Gönder'}
              </button>
            </div>
          )}

          {/* WhatsApp Simulation Tab */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-zinc-900">WhatsApp Mesaj Simülatörü</h2>
              <div className="space-y-4">
                <div>
                  <label className="form-label block mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="+905551234567"
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="form-helper mt-1">
                    Önce Mock Events ile bir sipariş oluşturun
                  </p>
                </div>
                <div>
                  <label className="form-label block mb-2">
                    Message
                  </label>
                  <textarea
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Kullanıcı mesajı..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleMockWhatsApp}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {loading ? 'İşleniyor...' : 'Mesaj Gönder'}
                </button>
              </div>
            </div>
          )}

          {/* RAG Test Tab */}
          {activeTab === 'rag' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-zinc-900">RAG Pipeline Testi</h2>
              <div className="space-y-4">
                <div>
                  <label className="form-label block mb-2">
                    Query
                  </label>
                  <textarea
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ürün hakkında soru..."
                  />
                </div>
                <div>
                  <label htmlFor="rag-product-ids" className="block text-sm font-medium text-zinc-700 mb-2">
                    Product IDs (comma-separated, optional)
                  </label>
                  <input
                    id="rag-product-ids"
                    type="text"
                    value={ragProductIds}
                    onChange={(e) => setRagProductIds(e.target.value)}
                    placeholder="e.g. uuid-1, uuid-2"
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="form-helper mt-1">
                    Boş bırakırsanız tüm ürünlerde aranır. UUID’leri Ürünler sayfasından alabilirsiniz.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleRAGTest}
                    disabled={loading}
                    className="px-6 py-2 bg-zinc-200 text-zinc-800 rounded-lg hover:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                  >
                    {loading ? 'İşleniyor...' : 'Sadece RAG (parçalar)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRAGAnswer}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                  >
                    {loading ? 'İşleniyor...' : 'RAG + AI ile cevap al'}
                  </button>
                </div>
              </div>

              {/* RAG result – shown in-tab so response is always visible */}
              {result && typeof result.count === 'number' && (
                <div className="mt-6 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                  {result.answer != null && result.answer !== '' && (
                    <div className="rounded-lg border-2 border-teal-200 bg-teal-50/80 p-4">
                      <h3 className="font-semibold text-teal-900 mb-2">AI Cevabı</h3>
                      <p className="text-zinc-800 whitespace-pre-wrap">{result.answer}</p>
                    </div>
                  )}
                  <h3 className="font-semibold text-zinc-900">
                    {result.answer != null ? 'RAG parçaları: ' : ''}{result.count} sonuç
                  </h3>
                  {result.hint && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                      {result.hint}
                    </div>
                  )}
                  {result.results && result.results.length > 0 ? (
                    <ul className="space-y-3">
                      {result.results.map((r: { chunkId?: string; productName?: string; chunkText?: string; similarity?: number }, i: number) => (
                        <li key={r.chunkId ?? i} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                          <p className="font-medium text-zinc-900">{r.productName ?? 'Ürün'}</p>
                          <p className="mt-1 text-zinc-700">{r.chunkText}</p>
                          {typeof r.similarity === 'number' && (
                            <p className="mt-1 text-xs text-zinc-500">Benzerlik: {(r.similarity * 100).toFixed(1)}%</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-600">Eşleşen parça yok. Ürün ekleyip embedding ürettiğinizden emin olun.</p>
                  )}
                </div>
              )}
              {result && result.error && (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-medium">Hata</p>
                  <p className="mt-1">{result.error}</p>
                  {result.message && <p className="mt-1 text-red-700">{result.message}</p>}
                </div>
              )}
            </div>
          )}

          {/* Scheduled Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="space-y-6" id="panel-tasks" role="tabpanel" aria-labelledby="tab-tasks">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-zinc-900">Scheduled Tasks</h2>
                <button
                  type="button"
                  onClick={loadTasks}
                  disabled={tasksLoading}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tasksLoading ? 'Yükleniyor...' : 'Yenile'}
                </button>
              </div>
              {tasksLoading && tasks.length === 0 ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-10 bg-zinc-200 rounded" />
                  <div className="h-10 bg-zinc-200 rounded" />
                  <div className="h-10 bg-zinc-200 rounded" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-zinc-500">Henüz scheduled task yok</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Execute At</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-200">
                      {tasks.map((task) => (
                        <tr key={task.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900">{task.task_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                            {new Date(task.execute_at).toLocaleString('tr-TR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                task.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : task.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {task.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {task.status === 'pending' && (
                              <button
                                onClick={() => handleTriggerTask(task.id)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Tetikle
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* System Health Tab */}
          {activeTab === 'health' && (
            <div className="space-y-6" id="panel-health" role="tabpanel" aria-labelledby="tab-health">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-zinc-900">System Health</h2>
                <button
                  type="button"
                  onClick={loadHealth}
                  disabled={healthLoading}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {healthLoading ? 'Yükleniyor...' : 'Yenile'}
                </button>
              </div>
              {healthError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <p className="font-medium">Yüklenemedi</p>
                  <p className="mt-1">{healthError}</p>
                  <button
                    type="button"
                    onClick={loadHealth}
                    className="mt-3 text-sm font-medium text-red-600 hover:text-red-800 underline"
                  >
                    Tekrar dene
                  </button>
                </div>
              )}
              {healthLoading && !health && !healthError && (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-zinc-200 rounded-lg" />
                  <div className="h-32 bg-zinc-200 rounded-lg" />
                </div>
              )}
              {health && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-4">Database</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Orders:</span>
                        <span className="font-semibold">{health.database.orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Users:</span>
                        <span className="font-semibold">{health.database.users}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Conversations:</span>
                        <span className="font-semibold">{health.database.conversations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Products:</span>
                        <span className="font-semibold">{health.database.products}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-4">Queues</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Redis:</span>
                        <span
                          className={`font-semibold ${
                            health.queues.redis === 'connected' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {health.queues.redis}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-4 mt-6">Tasks</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Pending:</span>
                        <span className="font-semibold text-yellow-600">{health.tasks.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Completed:</span>
                        <span className="font-semibold text-green-600">{health.tasks.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Failed:</span>
                        <span className="font-semibold text-red-600">{health.tasks.failed}</span>
                      </div>
                    </div>
                    {health.openai && (
                      <>
                        <h3 className="text-lg font-semibold text-zinc-900 mb-4 mt-6">OpenAI API Key</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-600">Status:</span>
                            <span
                              className={`font-semibold ${
                                health.openai.status === 'ok'
                                  ? 'text-green-600'
                                  : health.openai.status === 'invalid'
                                    ? 'text-red-600'
                                    : health.openai.status === 'error'
                                      ? 'text-red-600'
                                      : health.openai.status === 'placeholder'
                                        ? 'text-amber-600'
                                        : 'text-red-600'
                              }`}
                            >
                              {health.openai.status === 'ok'
                                ? (health.openai.verified ? 'Working' : 'Configured')
                                : health.openai.status === 'invalid'
                                  ? 'Invalid'
                                  : health.openai.status === 'error'
                                    ? 'Error'
                                    : health.openai.status === 'placeholder'
                                      ? 'Placeholder'
                                      : 'Missing'}
                            </span>
                          </div>
                          {health.openai.message && (
                            <p className="text-sm text-zinc-600 mt-1">{health.openai.message}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="mt-6 space-y-3">
              {result.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  <p className="font-medium">Hata</p>
                  <p className="mt-1">{result.error}</p>
                </div>
              )}
              {result.hint && !result.error && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                  <p className="font-medium">İpucu</p>
                  <p className="mt-1">{result.hint}</p>
                </div>
              )}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                <h3 className="font-semibold text-zinc-900 mb-2">Sonuç:</h3>
                <pre className="text-xs overflow-x-auto text-zinc-700 break-words">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    
  );
}
