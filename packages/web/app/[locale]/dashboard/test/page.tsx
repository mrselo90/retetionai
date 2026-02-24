'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { BlockStack, Box, Button, Card, InlineGrid, InlineStack, Layout, Page, Tabs, Text } from '@shopify/polaris';
import { ChevronDown, ChevronUp, Check, ArrowRight, Plus, X, RefreshCw } from 'lucide-react';

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

interface Product {
  name: string;
  id: string;
  url: string;
}

interface MerchantProduct {
  id: string;
  name: string;
  url: string;
  raw_text?: string | null;
}

interface MerchantProductWithChunks extends MerchantProduct {
  chunkCount?: number;
  chunkCountUnavailable?: boolean;
}

interface OrderData {
  orderId: string;
  customerPhone: string;
  customerName: string;
  deliveryDate: string;
  products: Product[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function TestInterfacePage() {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Step 1: Order creation
  const [customerPhone, setCustomerPhone] = useState('+905551234567');
  const [customerName, setCustomerName] = useState('Test Kullanıcı');
  const [orderId, setOrderId] = useState(`TEST-ORD-${Date.now()}`);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [products, setProducts] = useState<Product[]>([
    { name: 'Test Ürün', id: 'PROD-001', url: 'https://example.com/product' }
  ]);

  // Step 3: Chat
  const [chatMessage, setChatMessage] = useState('Bu ürünü nasıl kullanmalıyım?');

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<'rag' | 'health' | 'tasks'>('rag');

  // RAG test state
  const [ragQuery, setRagQuery] = useState('Bu ürün nasıl kullanılır?');
  const [ragProductIds, setRagProductIds] = useState('');
  const [ragProductSearch, setRagProductSearch] = useState('');
  const [ragOnlyReady, setRagOnlyReady] = useState(true);
  const [ragProductsList, setRagProductsList] = useState<MerchantProductWithChunks[]>([]);
  const [ragProductsLoading, setRagProductsLoading] = useState(false);
  const [ragProductsLoaded, setRagProductsLoaded] = useState(false);
  const [ragResult, setRagResult] = useState<any>(null);

  // Tasks state
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Health state
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Loading states
  const [step1Loading, setStep1Loading] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);
  const [step3Loading, setStep3Loading] = useState(false);
  const [ragLoading, setRagLoading] = useState(false);

  const addProduct = () => {
    setProducts([...products, { name: '', id: '', url: '' }]);
  };

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof Product, value: string) => {
    const newProducts = [...products];
    newProducts[index][field] = value;
    setProducts(newProducts);
  };

  const handleCreateOrder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setStep1Loading(true);

      const response = await authenticatedRequest<any>(
        '/api/test/events',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            event_type: 'order_created',
            external_order_id: orderId,
            customer_phone: customerPhone,
            customer_name: customerName,
            order_status: 'created',
            delivery_date: deliveryDate,
            products: products.map(p => ({
              external_product_id: p.id,
              name: p.name,
              url: p.url,
            })),
          }),
        }
      );

      if (response.error) {
        toast.error('Sipariş oluşturulamadı', response.error);
        return;
      }

      setOrderData({
        orderId,
        customerPhone,
        customerName,
        deliveryDate,
        products: [...products],
      });

      toast.success('Sipariş oluşturuldu', 'Artık teslimat eventini tetikleyebilirsiniz.');
      setCurrentStep(2);
    } catch (err: any) {
      console.error('Create order error:', err);
      toast.error('Hata', err.message || 'Sipariş oluşturulamadı');
    } finally {
      setStep1Loading(false);
    }
  };

  const handleTriggerDelivery = async () => {
    if (!orderData) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setStep2Loading(true);

      const response = await authenticatedRequest<any>(
        '/api/test/events',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            event_type: 'order_delivered',
            external_order_id: orderData.orderId,
            customer_phone: orderData.customerPhone,
            customer_name: orderData.customerName,
            order_status: 'delivered',
            delivery_date: orderData.deliveryDate,
            products: orderData.products.map(p => ({
              external_product_id: p.id,
              name: p.name,
              url: p.url,
            })),
          }),
        }
      );

      if (response.error) {
        toast.error('Teslimat eventi oluşturulamadı', response.error);
        return;
      }

      toast.success('Teslimat eventi gönderildi', 'Artık müşteri ile sohbet edebilirsiniz.');
      setCurrentStep(3);
    } catch (err: any) {
      console.error('Trigger delivery error:', err);
      toast.error('Hata', err.message || 'Teslimat eventi gönderilemedi');
    } finally {
      setStep2Loading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!orderData || !chatMessage.trim()) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setStep3Loading(true);

      // Add user message to history
      const userMessage: ChatMessage = { role: 'user', content: chatMessage };
      setChatHistory(prev => [...prev, userMessage]);

      const response = await authenticatedRequest<any>(
        '/api/test/whatsapp',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            phone: orderData.customerPhone,
            message: chatMessage,
          }),
        }
      );

      if (response.error) {
        toast.error('Mesaj gönderilemedi', response.error);
        return;
      }

      // Add AI response to history
      const aiMessage: ChatMessage = { 
        role: 'assistant', 
        content: response.aiResponse || 'Cevap alınamadı' 
      };
      setChatHistory(prev => [...prev, aiMessage]);

      setChatMessage('');
      toast.success('Mesaj gönderildi');
    } catch (err: any) {
      console.error('Send message error:', err);
      toast.error('Hata', err.message || 'Mesaj gönderilemedi');
    } finally {
      setStep3Loading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setOrderData(null);
    setChatHistory([]);
    setOrderId(`TEST-ORD-${Date.now()}`);
    toast.success('Test sıfırlandı', 'Yeni bir test başlatabilirsiniz.');
  };

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

  const handleTriggerTask = async (taskId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest<any>(
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

  const handleRAGTest = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setRagLoading(true);
      setRagResult(null);

      const response = await authenticatedRequest<any>(
        '/api/test/rag',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            query: ragQuery,
            productIds: ragProductIds
              ? ragProductIds.split(',').map((id) => id.trim()).filter(Boolean)
              : undefined,
            topK: 5,
          }),
        }
      );

      setRagResult(response);
    } catch (err: any) {
      console.error('RAG test error:', err);
      setRagResult({ error: err.message || 'RAG testi başarısız' });
    } finally {
      setRagLoading(false);
    }
  };

  const parseSelectedRagProductIds = () =>
    ragProductIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

  const syncRagProductIds = (ids: string[]) => {
    setRagProductIds(Array.from(new Set(ids)).join(', '));
  };

  const toggleRagProductSelection = (productId: string) => {
    const selected = new Set(parseSelectedRagProductIds());
    if (selected.has(productId)) {
      selected.delete(productId);
    } else {
      selected.add(productId);
    }
    syncRagProductIds(Array.from(selected));
  };

  const selectAllVisibleRagProducts = () => {
    const ids = filteredRagProducts.map((p) => p.id);
    syncRagProductIds(ids);
  };

  const clearRagProductSelection = () => {
    setRagProductIds('');
  };

  const loadRAGProducts = async () => {
    setRagProductsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await authenticatedRequest<{ products?: MerchantProduct[] }>(
        '/api/products',
        session.access_token
      );
      const list = response?.products ?? [];
      if (list.length === 0) {
        setRagProductsList([]);
        setRagProductsLoaded(true);
        return;
      }

      try {
        const chunksResponse = await authenticatedRequest<{ chunkCounts: Array<{ productId: string; chunkCount: number }> }>(
          '/api/products/chunks/batch',
          session.access_token,
          {
            method: 'POST',
            body: JSON.stringify({ productIds: list.map((p) => p.id) }),
          }
        );
        const chunkCountMap = new Map((chunksResponse.chunkCounts ?? []).map((c) => [c.productId, c.chunkCount]));
        setRagProductsList(
          list.map((p) => ({
            ...p,
            chunkCount: chunkCountMap.get(p.id) ?? 0,
            chunkCountUnavailable: false,
          }))
        );
      } catch (chunkErr) {
        console.error('Failed to load chunk counts for RAG test products:', chunkErr);
        setRagProductsList(list.map((p) => ({ ...p, chunkCountUnavailable: true })));
      }
      setRagProductsLoaded(true);
    } catch (err: any) {
      console.error('Failed to load RAG test products:', err);
      toast.error('RAG test ürünleri yüklenemedi', err?.message || 'Ürün listesi alınamadı');
    } finally {
      setRagProductsLoading(false);
    }
  };

  const handleRAGAnswer = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setRagLoading(true);
      setRagResult(null);

      const response = await authenticatedRequest<any>(
        '/api/test/rag/answer',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            query: ragQuery,
            productIds: ragProductIds
              ? ragProductIds.split(',').map((id) => id.trim()).filter(Boolean)
              : undefined,
            topK: 5,
          }),
        }
      );

      setRagResult(response);
    } catch (err: any) {
      console.error('RAG + AI error:', err);
      setRagResult({ error: err.message || 'RAG + AI cevabı alınamadı' });
    } finally {
      setRagLoading(false);
    }
  };

  useEffect(() => {
    if (showAdvanced && advancedTab === 'tasks') {
      loadTasks();
    } else if (showAdvanced && advancedTab === 'health') {
      loadHealth();
    }
  }, [showAdvanced, advancedTab]);

  useEffect(() => {
    if (showAdvanced && advancedTab === 'rag' && !ragProductsLoaded && !ragProductsLoading) {
      loadRAGProducts();
    }
  }, [showAdvanced, advancedTab, ragProductsLoaded, ragProductsLoading]);

  const filteredRagProducts = ragProductsList.filter((product) => {
    const matchesSearch =
      !ragProductSearch.trim() ||
      product.name?.toLowerCase().includes(ragProductSearch.toLowerCase()) ||
      product.id.toLowerCase().includes(ragProductSearch.toLowerCase());
    const matchesReady = !ragOnlyReady || (typeof product.chunkCount === 'number' && product.chunkCount > 0);
    return matchesSearch && matchesReady;
  });

  const selectedRagIds = parseSelectedRagProductIds();
  const selectedRagIdSet = new Set(selectedRagIds);
  const advancedTabs = [
    { id: 'rag', content: 'RAG Test' },
    { id: 'health', content: 'System Health' },
    { id: 'tasks', content: 'Scheduled Tasks' },
  ];

  return (
    <Page title="Test & Development Interface" subtitle="Siparis olusturup bot ile konusarak sistemi test edin" fullWidth>
      <Layout>
        <Layout.Section>
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <Box padding="400">
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Test & Development Interface</Text>
            <Text as="p" tone="subdued">Sipariş oluşturup bot ile konuşarak sistemi test edin</Text>
          </BlockStack>
        </Box>
      </Card>

      {/* Step Indicator */}
      <Card>
        <Box padding="400">
          <InlineGrid columns={{ xs: '1fr', md: '1fr auto' }} gap="300" alignItems="center">
            <InlineStack gap="300" wrap>
              {[
                { step: 1, label: 'Sipariş Oluştur' },
                { step: 2, label: 'Teslimat Eventi' },
                { step: 3, label: 'Bot ile Sohbet' },
              ].map(({ step, label }, idx) => {
                const active = currentStep >= step;
                const completed = currentStep > step;
                return (
                  <InlineStack key={step} gap="200" blockAlign="center">
                    <Box
                      as="span"
                      borderRadius="full"
                      borderWidth="025"
                      borderColor={active ? 'border-emphasis' : 'border'}
                      background={active ? 'bg-fill-brand' : 'bg-surface'}
                      minWidth="40px"
                      minHeight="40px"
                    >
                      <div className="flex h-10 w-10 items-center justify-center">
                        {completed ? (
                          <Check className="h-4 w-4 text-white" />
                        ) : (
                          <span className={active ? 'text-white text-sm font-medium' : 'text-zinc-500 text-sm font-medium'}>
                            {step}
                          </span>
                        )}
                      </div>
                    </Box>
                    <Text as="span" variant="bodySm" fontWeight="medium" tone={active ? undefined : 'subdued'}>
                      {label}
                    </Text>
                    {idx < 2 && <ArrowRight className="h-4 w-4 text-zinc-300" />}
                  </InlineStack>
                );
              })}
            </InlineStack>
            {currentStep > 1 && (
              <InlineStack align="end">
                <Button onClick={handleReset} variant="plain">
                  Sıfırla
                </Button>
              </InlineStack>
            )}
          </InlineGrid>
        </Box>
      </Card>

      {/* Step 1: Create Order */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Adım 1: Sipariş Oluştur</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Test için bir sipariş oluşturun. Bu sipariş database'e kaydedilecek ve müşteri profili oluşturulacak.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Müşteri Telefonu
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+905551234567"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Müşteri Adı
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Sipariş ID
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Teslimat Tarihi
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-zinc-700">
                Ürünler
              </label>
              <button
                type="button"
                onClick={addProduct}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Ürün Ekle</span>
              </button>
            </div>

            <div className="space-y-3">
              {products.map((product, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border border-zinc-200 rounded-lg">
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => updateProduct(index, 'name', e.target.value)}
                    placeholder="Ürün adı"
                    className="px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={product.id}
                    onChange={(e) => updateProduct(index, 'id', e.target.value)}
                    placeholder="Ürün ID"
                    className="px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={product.url}
                      onChange={(e) => updateProduct(index, 'url', e.target.value)}
                      placeholder="Ürün URL"
                      className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={step1Loading || !customerPhone || !customerName || !orderId}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {step1Loading ? 'Oluşturuluyor...' : 'Sipariş Oluştur'}
          </button>
        </div>
      )}

      {/* Step 2: Trigger Delivery */}
      {currentStep === 2 && orderData && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Adım 2: Teslimat Eventi Tetikle</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Siparişin teslim edildiğini simüle edin. Bu, AI ajanını tetikleyecek ve müşteriye WhatsApp mesajı gönderecek.
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-zinc-900">Sipariş Detayları</h3>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Sipariş ID:</span> {orderData.orderId}</p>
              <p><span className="font-medium">Müşteri:</span> {orderData.customerName} ({orderData.customerPhone})</p>
              <p><span className="font-medium">Teslimat Tarihi:</span> {orderData.deliveryDate}</p>
              <p><span className="font-medium">Ürün Sayısı:</span> {orderData.products.length}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerDelivery}
            disabled={step2Loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {step2Loading ? 'Gönderiliyor...' : 'Teslimat Eventi Gönder'}
          </button>
        </div>
      )}

      {/* Step 3: Chat with Bot */}
      {currentStep === 3 && orderData && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Adım 3: Bot ile Sohbet Et</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Müşteri olarak bot ile konuşun. AI ajan ürün bilgisi ve sipariş geçmişi ile cevap verecek.
            </p>
          </div>

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <div className="border border-zinc-200 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user' 
                      ? 'bg-zinc-100 text-zinc-900' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message Input */}
          <div className="space-y-3">
            <textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={3}
              placeholder="Mesajınızı yazın... (Enter ile gönderin)"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={step3Loading || !chatMessage.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {step3Loading ? 'Gönderiliyor...' : 'Mesaj Gönder'}
            </button>
          </div>
        </div>
      )}

      {/* Advanced Section */}
      <div className="border-t border-zinc-200 pt-6">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-zinc-700 hover:text-zinc-900 font-medium"
        >
          {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          <span>Gelişmiş Test Araçları</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* Advanced Tabs */}
            <Tabs
              tabs={advancedTabs}
              selected={advancedTabs.findIndex((tab) => tab.id === advancedTab)}
              onSelect={(index) => setAdvancedTab(advancedTabs[index].id as 'rag' | 'health' | 'tasks')}
            />

            {/* RAG Test Tab */}
            {advancedTab === 'rag' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900">RAG Pipeline Testi</h3>
                    <p className="text-sm text-zinc-600 mt-1">
                      Mevcut scrape edilmiş ürünleri seçip ürün sorularını manuel test edin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadRAGProducts}
                    disabled={ragProductsLoading}
                    className="px-3 py-2 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {ragProductsLoading ? 'Yükleniyor...' : 'Ürünleri Yenile'}
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Query
                  </label>
                  <textarea
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ürün hakkında soru..."
                  />
                </div>

                <div className="border border-zinc-200 rounded-lg p-4 space-y-3 bg-zinc-50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Test edilecek ürünler</label>
                      <p className="text-xs text-zinc-500 mt-1">
                        Seçmezseniz tüm ürünlerde arar (önerilmez). 1 ürün seçmek en doğru sonuç verir.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectAllVisibleRagProducts}
                        disabled={filteredRagProducts.length === 0}
                        className="px-3 py-1.5 text-xs border border-zinc-300 rounded-md hover:bg-white disabled:opacity-50"
                      >
                        Görünenleri Seç
                      </button>
                      <button
                        type="button"
                        onClick={clearRagProductSelection}
                        disabled={selectedRagIds.length === 0}
                        className="px-3 py-1.5 text-xs border border-zinc-300 rounded-md hover:bg-white disabled:opacity-50"
                      >
                        Seçimi Temizle
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <input
                      type="text"
                      value={ragProductSearch}
                      onChange={(e) => setRagProductSearch(e.target.value)}
                      placeholder="Ürün ara (isim veya ID)"
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <label className="inline-flex items-center gap-2 text-sm text-zinc-700 bg-white border border-zinc-300 rounded-lg px-3 py-2">
                      <input
                        type="checkbox"
                        checked={ragOnlyReady}
                        onChange={(e) => setRagOnlyReady(e.target.checked)}
                        className="rounded border-zinc-300"
                      />
                      Sadece RAG Ready
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedRagIds.length === 0 ? (
                      <span className="text-xs text-zinc-500">Henüz ürün seçilmedi</span>
                    ) : (
                      selectedRagIds.slice(0, 6).map((id) => {
                        const p = ragProductsList.find((x) => x.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">
                            <span className="truncate max-w-[180px]">{p?.name || id}</span>
                            <button
                              type="button"
                              onClick={() => toggleRagProductSelection(id)}
                              className="text-blue-700 hover:text-blue-900"
                              aria-label="Ürünü seçimden kaldır"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })
                    )}
                    {selectedRagIds.length > 6 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs">
                        +{selectedRagIds.length - 6} ürün
                      </span>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto border border-zinc-200 rounded-lg bg-white divide-y divide-zinc-100">
                    {!ragProductsLoaded && !ragProductsLoading ? (
                      <div className="p-3 text-sm text-zinc-500">Ürün listesi yüklenmedi</div>
                    ) : ragProductsLoading ? (
                      <div className="p-3 text-sm text-zinc-500">Ürünler yükleniyor...</div>
                    ) : filteredRagProducts.length === 0 ? (
                      <div className="p-3 text-sm text-zinc-500">Filtreye uygun ürün bulunamadı</div>
                    ) : (
                      filteredRagProducts.map((product) => {
                        const isSelected = selectedRagIdSet.has(product.id);
                        const isReady = typeof product.chunkCount === 'number' ? product.chunkCount > 0 : false;
                        return (
                          <label
                            key={product.id}
                            className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-zinc-50 ${isSelected ? 'bg-blue-50/60' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRagProductSelection(product.id)}
                              className="mt-1 rounded border-zinc-300"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm text-zinc-900 truncate">{product.name || '(İsimsiz ürün)'}</p>
                                {product.chunkCountUnavailable ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 bg-amber-50">
                                    Chunk bilinmiyor
                                  </span>
                                ) : isReady ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50">
                                    RAG Ready ({product.chunkCount})
                                  </span>
                                ) : (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-600 bg-zinc-50">
                                    RAG not ready
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-zinc-500 break-all">{product.id}</p>
                              {product.url && (
                                <p className="mt-1 text-xs text-zinc-500 break-all line-clamp-1">{product.url}</p>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Product IDs (comma-separated, optional)
                  </label>
                  <input
                    type="text"
                    value={ragProductIds}
                    onChange={(e) => setRagProductIds(e.target.value)}
                    placeholder="e.g. uuid-1, uuid-2"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Yukarıdan ürün seçtiğinizde bu alan otomatik dolar. Boş bırakırsanız tüm ürünlerde aranır.
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleRAGTest}
                    disabled={ragLoading}
                    className="px-4 py-2 bg-zinc-200 text-zinc-800 rounded-lg hover:bg-zinc-300 transition-colors disabled:opacity-50"
                  >
                    {ragLoading ? 'İşleniyor...' : 'Sadece RAG'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRAGAnswer}
                    disabled={ragLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {ragLoading ? 'İşleniyor...' : 'RAG + AI Cevap'}
                  </button>
                </div>

                {/* RAG Results */}
                {ragResult && typeof ragResult.count === 'number' && (
                  <div className="mt-4 space-y-3 border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                    {ragResult.answer && (
                      <div className="border-2 border-teal-200 bg-teal-50 rounded-lg p-4">
                        <h4 className="font-semibold text-teal-900 mb-2">AI Cevabı</h4>
                        <p className="text-zinc-800 whitespace-pre-wrap">{ragResult.answer}</p>
                      </div>
                    )}
                    <h4 className="font-semibold text-zinc-900">
                      {ragResult.count} RAG sonucu
                    </h4>
                    {ragResult.results && ragResult.results.length > 0 ? (
                      <ul className="space-y-2">
                        {ragResult.results.map((r: any, i: number) => (
                          <li key={i} className="border border-zinc-200 bg-white rounded p-3 text-sm">
                            <p className="font-medium text-zinc-900">{r.productName}</p>
                            <p className="text-zinc-700 mt-1">{r.chunkText}</p>
                            {typeof r.similarity === 'number' && (
                              <p className="text-xs text-zinc-500 mt-1">
                                Benzerlik: {(r.similarity * 100).toFixed(1)}%
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-600">Sonuç bulunamadı</p>
                    )}
                  </div>
                )}

                {ragResult && ragResult.error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    <p className="font-medium">Hata</p>
                    <p className="mt-1">{ragResult.error}</p>
                  </div>
                )}
              </div>
            )}

            {/* System Health Tab */}
            {advancedTab === 'health' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zinc-900">System Health</h3>
                  <button
                    type="button"
                    onClick={loadHealth}
                    disabled={healthLoading}
                    className="px-3 py-1 text-sm border border-zinc-300 rounded hover:bg-zinc-50"
                  >
                    {healthLoading ? 'Yükleniyor...' : 'Yenile'}
                  </button>
                </div>

                {healthError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    <p className="font-medium">Yüklenemedi</p>
                    <p className="mt-1">{healthError}</p>
                  </div>
                )}

                {health && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-zinc-900 mb-3">Database</h4>
                      <div className="space-y-2 text-sm">
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
                      <h4 className="font-semibold text-zinc-900 mb-3">Queues & Tasks</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-600">Redis:</span>
                          <span className={`font-semibold ${
                            health.queues.redis === 'connected' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {health.queues.redis}
                          </span>
                        </div>
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
                          <h4 className="font-semibold text-zinc-900 mb-3 mt-4">OpenAI</h4>
                          <div className="text-sm">
                            <div className="flex justify-between">
                              <span className="text-zinc-600">Status:</span>
                              <span className={`font-semibold ${
                                health.openai.status === 'ok' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {health.openai.verified ? 'Working' : health.openai.status}
                              </span>
                            </div>
                            {health.openai.message && (
                              <p className="text-xs text-zinc-600 mt-1">{health.openai.message}</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Scheduled Tasks Tab */}
            {advancedTab === 'tasks' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zinc-900">Scheduled Tasks</h3>
                  <button
                    type="button"
                    onClick={loadTasks}
                    disabled={tasksLoading}
                    className="px-3 py-1 text-sm border border-zinc-300 rounded hover:bg-zinc-50"
                  >
                    {tasksLoading ? 'Yükleniyor...' : 'Yenile'}
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <p className="text-zinc-500 text-sm">Henüz scheduled task yok</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 text-sm">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Execute At</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-zinc-200">
                        {tasks.map((task) => (
                          <tr key={task.id}>
                            <td className="px-4 py-3 whitespace-nowrap">{task.task_type}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                              {new Date(task.execute_at).toLocaleString('tr-TR')}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {task.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              {task.status === 'pending' && (
                                <button
                                  onClick={() => handleTriggerTask(task.id)}
                                  className="text-blue-600 hover:text-blue-900 text-xs"
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
          </div>
        )}
      </div>
    </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
