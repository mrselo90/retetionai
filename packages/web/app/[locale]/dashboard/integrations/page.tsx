'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest, getApiUrl, getApiBaseUrlForDisplay } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Trash2, Pencil, Plug, Upload, Code, MessageSquare, ShoppingBag } from 'lucide-react';

interface Integration {
  id: string;
  provider: 'shopify' | 'woocommerce' | 'ticimax' | 'manual' | 'whatsapp';
  status: 'pending' | 'active' | 'error' | 'disabled';
  auth_type: 'oauth' | 'api_key' | 'token';
  created_at: string;
  updated_at: string;
  phone_number_display?: string;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [shopifyShop, setShopifyShop] = useState('');
  const [connectingShopify, setConnectingShopify] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);
  const [whatsappPhoneDisplay, setWhatsappPhoneDisplay] = useState('');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappAccessToken, setWhatsappAccessToken] = useState('');
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState('');
  const [editingWhatsAppId, setEditingWhatsAppId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Array<{ id: number; hash: string }>>([]);
  const [platformWhatsApp, setPlatformWhatsApp] = useState<string>('');

  useEffect(() => {
    loadIntegrations();
    loadApiKeys();
    loadPlatformContact();
  }, []);

  const loadPlatformContact = async () => {
    try {
      const res = await fetch(getApiUrl('/api/config/platform-contact'));
      if (res.ok) {
        const data = await res.json();
        setPlatformWhatsApp(data.whatsapp_number || '');
      }
    } catch {
      setPlatformWhatsApp('+905545736900');
    }
  };

  const loadApiKeys = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const response = await authenticatedRequest<{ apiKeys: Array<{ id: number; hash: string }> }>(
          '/api/merchants/me/api-keys',
          session.access_token
        );
        setApiKeys(response.apiKeys);
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  };

  const loadIntegrations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const response = await authenticatedRequest<{ integrations: Integration[] }>(
        '/api/integrations',
        session.access_token
      );
      setIntegrations(response.integrations);
    } catch (err: any) {
      console.error('Failed to load integrations:', err);
      if (err.status === 401) {
        window.location.href = '/login';
      } else {
        toast.error('Entegrasyonlar yüklenirken bir hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectShopify = async () => {
    if (!shopifyShop) {
      toast.warning('Eksik Bilgi', 'Lütfen Shopify mağaza adresini girin');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setConnectingShopify(true);

      const response = await authenticatedRequest<{ authUrl: string }>(
        '/api/integrations/shopify/auth',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({ shop: shopifyShop }),
        }
      );

      // Redirect to Shopify OAuth
      window.location.href = response.authUrl;
    } catch (err: any) {
      console.error('Failed to connect Shopify:', err);
      toast.error('Hata', err.message || 'Shopify bağlantısı başarısız');
      setConnectingShopify(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    toast.info('Dosya Seçildi', file.name);
  };

  const handleImportCsv = async () => {
    if (!csvFile) {
      toast.warning('Eksik Dosya', 'Lütfen bir CSV dosyası seçin');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setImporting(true);

      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch(getApiUrl('/api/csv/import'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('CSV import failed');
      }

      const result = await response.json();
      toast.success('Başarılı!', `${result.imported} etkinlik içe aktarıldı`);

      setShowCsvModal(false);
      setCsvFile(null);
      await loadIntegrations();
    } catch (err: any) {
      console.error('Failed to import CSV:', err);
      toast.error('Hata', err.message || 'CSV içe aktarma başarısız');
    } finally {
      setImporting(false);
    }
  };

  const handleCreateManualIntegration = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest(
        '/api/integrations',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            provider: 'manual',
            auth_type: 'api_key',
            auth_data: {},
          }),
        }
      );

      toast.success('Oluşturuldu', 'Manuel entegrasyon başarıyla oluşturuldu');
      setShowManualModal(false);
      await loadIntegrations();
    } catch (err: any) {
      console.error('Failed to create manual integration:', err);
      toast.error('Hata', err.message || 'Manuel entegrasyon oluşturulamadı');
    }
  };

  const openWhatsAppModal = (integration?: Integration) => {
    if (integration?.provider === 'whatsapp') {
      setEditingWhatsAppId(integration.id);
      setWhatsappPhoneDisplay(integration.phone_number_display || '');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
    } else {
      setEditingWhatsAppId(null);
      setWhatsappPhoneDisplay('');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
    }
    setShowWhatsAppModal(true);
  };

  const handleSaveWhatsApp = async () => {
    if (!whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim()) {
      toast.warning('Eksik Bilgi', 'Phone Number ID, Access Token ve Verify Token zorunludur');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setConnectingWhatsApp(true);
      const auth_data = {
        phone_number_id: whatsappPhoneNumberId.trim(),
        access_token: whatsappAccessToken.trim(),
        verify_token: whatsappVerifyToken.trim(),
        phone_number_display: whatsappPhoneDisplay.trim() || undefined,
      };
      if (editingWhatsAppId) {
        await authenticatedRequest(
          `/api/integrations/${editingWhatsAppId}`,
          session.access_token,
          { method: 'PUT', body: JSON.stringify({ auth_data, status: 'active' }) }
        );
        toast.success('Güncellendi', 'WhatsApp bağlantısı güncellendi');
      } else {
        await authenticatedRequest(
          '/api/integrations',
          session.access_token,
          {
            method: 'POST',
            body: JSON.stringify({
              provider: 'whatsapp',
              auth_type: 'token',
              auth_data,
            }),
          }
        );
        toast.success('Bağlandı', 'WhatsApp Business bağlantısı oluşturuldu');
      }
      setShowWhatsAppModal(false);
      setEditingWhatsAppId(null);
      setWhatsappPhoneDisplay('');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
      await loadIntegrations();
    } catch (err: any) {
      toast.error('Hata', err.message || 'WhatsApp bağlantısı kaydedilemedi');
    } finally {
      setConnectingWhatsApp(false);
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest(
        `/api/integrations/${integrationId}`,
        session.access_token,
        {
          method: 'DELETE',
        }
      );

      toast.success('Silindi', 'Entegrasyon başarıyla silindi');
      await loadIntegrations();
    } catch (err: any) {
      console.error('Failed to delete integration:', err);
      toast.error('Hata', err.message || 'Entegrasyon silinemedi');
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'shopify':
        return '🛍️';
      case 'woocommerce':
        return '🛒';
      case 'ticimax':
        return '🏪';
      case 'manual':
        return '📝';
      case 'whatsapp':
        return '💬';
      default:
        return '🔌';
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'shopify':
        return 'Shopify';
      case 'woocommerce':
        return 'WooCommerce';
      case 'ticimax':
        return 'Ticimax';
      case 'manual':
        return 'Manuel / API';
      case 'whatsapp':
        return 'WhatsApp Business';
      default:
        return provider;
    }
  };

  const hasWhatsApp = integrations.some((i) => i.provider === 'whatsapp');
  const hasShopify = integrations.some((i) => i.provider === 'shopify');
  const hasManual = integrations.some((i) => i.provider === 'manual');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'disabled':
        return 'bg-zinc-100 text-zinc-800';
      default:
        return 'bg-zinc-100 text-zinc-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Aktif';
      case 'error':
        return 'Hata';
      case 'pending':
        return 'Bekliyor';
      case 'disabled':
        return 'Devre Dışı';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-zinc-200 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Entegrasyonlar</h1>
        <p className="text-muted-foreground">
          E-ticaret platformlarınızı bağlayın ve siparişleri otomatik takip edin
        </p>
      </div>

      {/* Platform support number */}
      {platformWhatsApp && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <p className="font-medium text-zinc-900">Kurumsal destek (GlowGuide)</p>
              <p className="text-sm text-zinc-600">WhatsApp ile bize ulaşın</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${platformWhatsApp.replace(/^\+/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm whitespace-nowrap"
          >
            {platformWhatsApp}
          </a>
        </div>
      )}

      {/* Integration Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* WhatsApp Business */}
        <div className={`rounded-xl shadow-sm p-6 ${hasWhatsApp ? 'bg-emerald-50/80 border-2 border-emerald-300' : 'bg-white border border-zinc-200/80'}`}>
          <div className="text-center relative">
            {hasWhatsApp && (
              <span className="absolute top-0 right-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                ✓ Bağlı
              </span>
            )}
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">WhatsApp Business</h3>
            <p className="text-sm text-zinc-600 mb-6">
              {hasWhatsApp ? 'Kendi numaranız bağlı. Güncellemek için tıklayın.' : 'Müşterilere mesaj göndermek için kendi WhatsApp Business numaranızı bağlayın'}
            </p>
            <Button
              onClick={() => openWhatsAppModal(integrations.find((i) => i.provider === 'whatsapp'))}
              className="w-full"
            >
              {hasWhatsApp ? 'Güncelle' : 'Bağla'}
            </Button>
          </div>
        </div>

        {/* Shopify */}
        <div className={`rounded-xl shadow-sm p-6 ${hasShopify ? 'bg-green-50/80 border-2 border-green-300' : 'bg-white border border-zinc-200/80'}`}>
          <div className="text-center relative">
            {hasShopify && (
              <span className="absolute top-0 right-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ Bağlı
              </span>
            )}
            <div className="text-5xl mb-4">🛍️</div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Shopify</h3>
            <p className="text-sm text-zinc-600 mb-6">
              {hasShopify ? 'Mağazanız bağlı. Yeniden bağlamak için tıklayın.' : 'Shopify mağazanızı OAuth ile bağlayın'}
            </p>
            <Button
              onClick={() => setShowShopifyModal(true)}
              variant={hasShopify ? 'outline' : 'default'}
              className="w-full"
            >
              {hasShopify ? 'Bağlı' : 'Bağlan'}
            </Button>
          </div>
        </div>

        {/* CSV Import */}
        <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm p-6">
          <div className="text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">CSV İçe Aktar</h3>
            <p className="text-sm text-zinc-600 mb-6">
              Sipariş verilerinizi CSV ile yükleyin
            </p>
            <Button
              onClick={() => setShowCsvModal(true)}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              İçe Aktar
            </Button>
          </div>
        </div>

        {/* Manual / API */}
        <div className={`rounded-xl shadow-sm p-6 ${hasManual ? 'bg-purple-50/80 border-2 border-purple-300' : 'bg-white border border-zinc-200/80'}`}>
          <div className="text-center relative">
            {hasManual && (
              <span className="absolute top-0 right-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                ✓ Bağlı
              </span>
            )}
            <div className="text-5xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Manuel / API</h3>
            <p className="text-sm text-zinc-600 mb-6">
              {hasManual ? 'API entegrasyonu kurulu.' : 'API webhook ile kendi sisteminizi entegre edin'}
            </p>
            <Button
              onClick={() => setShowManualModal(true)}
              variant={hasManual ? 'outline' : 'default'}
              className="w-full"
            >
              <Code className="w-4 h-4 mr-2" />
              {hasManual ? 'Bağlı' : 'Kur'}
            </Button>
          </div>
        </div>
      </div>

      {/* Active Integrations */}
      <div className="pt-1">
        <h2 className="text-xl font-bold tracking-tight mb-3">Aktif Entegrasyonlar</h2>
        {integrations.length > 0 ? (
          <Card>
            <div className="divide-y">
              {integrations.map((integration) => (
                <div key={integration.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{getProviderIcon(integration.provider)}</div>
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-900">
                          {getProviderName(integration.provider)}
                          {integration.provider === 'whatsapp' && integration.phone_number_display && (
                            <span className="ml-2 text-sm font-normal text-zinc-500">
                              — {integration.phone_number_display}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-zinc-600 mt-1">
                          Oluşturulma: {new Date(integration.created_at).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={integration.status === 'active' ? 'default' : integration.status === 'error' ? 'destructive' : 'secondary'}>
                        {getStatusText(integration.status)}
                      </Badge>
                      {integration.provider === 'whatsapp' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openWhatsAppModal(integration)}
                          title="Güncelle"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Bu entegrasyonu silmek istediğinizden emin misiniz?')) {
                            handleDeleteIntegration(integration.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Plug className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Henüz entegrasyon yok
              </h3>
              <p className="text-muted-foreground mb-6">
                Yukarıdaki seçeneklerden birini kullanarak ilk entegrasyonunuzu oluşturun
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => setShowShopifyModal(true)}>
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Shopify Bağla
                </Button>
                <Button variant="outline" onClick={() => setShowCsvModal(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  CSV İçe Aktar
                </Button>
                <Button variant="outline" onClick={() => setShowManualModal(true)}>
                  <Code className="w-4 h-4 mr-2" />
                  API Kurulumu
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Shopify Modal */}
      {showShopifyModal && (
        <div className="modal-overlay">
          <Card className="max-w-md w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Shopify Bağla</CardTitle>
                <button
                  onClick={() => !connectingShopify && setShowShopifyModal(false)}
                  disabled={connectingShopify}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="form-label">
                  Shopify Mağaza Adresi
                </label>
                <Input
                  type="text"
                  value={shopifyShop}
                  onChange={(e) => setShopifyShop(e.target.value)}
                  placeholder="example.myshopify.com"
                  disabled={connectingShopify}
                  className="h-11"
                />
                <p className="form-helper">
                  Shopify mağazanızın tam adresi (.myshopify.com ile)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowShopifyModal(false)} disabled={connectingShopify}>
                  İptal
                </Button>
                <Button className="flex-1" onClick={handleConnectShopify} disabled={connectingShopify}>
                  {connectingShopify && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {connectingShopify ? 'Bağlanıyor...' : 'Bağlan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV Modal */}
      {showCsvModal && (
        <div className="modal-overlay">
          <Card className="max-w-md w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>CSV İçe Aktar</CardTitle>
                <button
                  onClick={() => !importing && setShowCsvModal(false)}
                  disabled={importing}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="form-label">
                  CSV Dosyası
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  disabled={importing}
                  className="w-full px-3 py-2 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-sm"
                />
                {csvFile && (
                  <p className="text-sm text-emerald-600">
                    ✓ {csvFile.name} seçildi
                  </p>
                )}
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Format:</strong> CSV dosyanız şu sütunları içermelidir:
                  order_id, customer_phone, customer_name, status, delivery_date
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCsvModal(false)} disabled={importing}>
                  İptal
                </Button>
                <Button className="flex-1" onClick={handleImportCsv} disabled={importing || !csvFile}>
                  {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {importing ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manual Integration Modal */}
      {showManualModal && (
        <div className="modal-overlay">
          <Card className="max-w-2xl w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Manuel / API Entegrasyonu</CardTitle>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <p className="text-sm font-medium mb-2">
                  API Webhook URL:
                </p>
                <code className="block bg-white px-3 py-2 rounded border text-sm font-mono">
                  {getApiBaseUrlForDisplay()}/api/webhooks/manual
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Bu URL'e POST request göndererek sipariş etkinliklerini gönderebilirsiniz.
                </p>
              </div>

              {apiKeys.length > 0 && (
                <div className="space-y-2">
                  <p className="form-label">API Key (Settings'ten alın):</p>
                  <code className="block bg-muted px-3 py-2 rounded border text-sm font-mono">
                    {apiKeys[0]?.hash.substring(0, 20)}...
                  </code>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowManualModal(false)}>
                  İptal
                </Button>
                <Button className="flex-1" onClick={handleCreateManualIntegration}>
                  Entegrasyonu Oluştur
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WhatsApp Business Modal */}
      {showWhatsAppModal && (
        <div className="modal-overlay">
          <Card className="max-w-md w-full animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingWhatsAppId ? 'WhatsApp Bağlantısını Güncelle' : 'WhatsApp Business Bağla'}
                </CardTitle>
                <button
                  onClick={() => !connectingWhatsApp && setShowWhatsAppModal(false)}
                  disabled={connectingWhatsApp}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Meta for Developers üzerinden aldığınız Phone Number ID, Access Token ve Verify Token bilgilerini girin.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="form-label">Görünen numara (isteğe bağlı)</label>
                  <Input
                    type="text"
                    value={whatsappPhoneDisplay}
                    onChange={(e) => setWhatsappPhoneDisplay(e.target.value)}
                    placeholder="+90 555 123 45 67"
                    disabled={connectingWhatsApp}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label">Phone Number ID *</label>
                  <Input
                    type="text"
                    value={whatsappPhoneNumberId}
                    onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                    placeholder="Meta API Setup'tan alın"
                    disabled={connectingWhatsApp}
                    className="h-11 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label">Access Token *</label>
                  <Input
                    type="password"
                    value={whatsappAccessToken}
                    onChange={(e) => setWhatsappAccessToken(e.target.value)}
                    placeholder="Meta'dan alınan token"
                    disabled={connectingWhatsApp}
                    className="h-11 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label">Verify Token (webhook) *</label>
                  <Input
                    type="text"
                    value={whatsappVerifyToken}
                    onChange={(e) => setWhatsappVerifyToken(e.target.value)}
                    placeholder="Webhook doğrulama için"
                    disabled={connectingWhatsApp}
                    className="h-11 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowWhatsAppModal(false)} disabled={connectingWhatsApp}>
                  İptal
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveWhatsApp}
                  disabled={connectingWhatsApp || !whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim()}
                >
                  {connectingWhatsApp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {connectingWhatsApp ? 'Kaydediliyor...' : editingWhatsAppId ? 'Güncelle' : 'Bağla'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
