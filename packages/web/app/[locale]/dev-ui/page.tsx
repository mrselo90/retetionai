'use client';

import { notFound } from 'next/navigation';
import { Shell } from '@/components/recete/Shell';
import { ProductsTable } from '@/components/recete/ProductsTable';
import { Avatar, Badge, Button, Card, CountBadge, EmptyState, Input, ProgressBar, Select, Skeleton, TableWrap, Textarea } from '@/components/recete';

/** Internal component gallery — verifies the primitives render as designed. */
export default function DevUiPage() {
  // Internal gallery: useful while the design is being implemented, but it must
  // not exist in production as an unauthenticated route.
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <Shell
      brandPlan="Growth"
      user={{ name: 'Selim Boyuk', org: 'Olive & Oak' }}
      status={{ label: 'WhatsApp connected · all systems normal' }}
      setup={{ done: 2, total: 3, nextLabel: 'Next: connect Shopify →', href: '/dashboard/integrations' }}
      actions={<><Button variant="secondary">Last 30 days</Button><Button variant="primary">+ Add Product</Button></>}
      sections={[
        { label: 'Workspace', items: [
          { href: '/dashboard', label: 'Dashboard', icon: '◳' },
          { href: '/dashboard/conversations', label: 'Inbox', icon: '💬', count: 1, countLabel: 'threads need a reply' },
          { href: '/dashboard/flows', label: 'Flows', icon: '↝' },
          { href: '/dashboard/products', label: 'Products', icon: '◇' },
          { href: '/dashboard/customers', label: 'Customers', icon: '◔' },
          { href: '/dashboard/analytics', label: 'Analytics', icon: '◫' },
        ]},
        { label: 'Configure', items: [
          { href: '/dashboard/integrations', label: 'Integrations', icon: '⟐' },
          { href: '/dashboard/playground', label: 'Playground', icon: '▶' },
          { href: '/dashboard/settings', label: 'Settings', icon: '⚙' },
        ]},
      ]}
    >
        <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <h1 className="r-page-title">Component gallery</h1>
            <p className="r-page-sub">Recete UI primitives · design direction 1b</p>
          </div>

          <Card>
            <p className="r-eyebrow" style={{ marginBottom: 12 }}>Buttons</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="primary">Add Product</Button>
              <Button variant="secondary">Last 30 days</Button>
              <Button variant="ghost">View all →</Button>
              <Button variant="danger">Delete</Button>
              <Button variant="primary" loading>Saving</Button>
              <Button variant="secondary" disabled>Disabled</Button>
              <Button variant="primary" size="sm">Small</Button>
            </div>
          </Card>

          <Card>
            <p className="r-eyebrow" style={{ marginBottom: 12 }}>Badges</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge tone="success">Strong</Badge>
              <Badge tone="warning">At risk</Badge>
              <Badge tone="caution">Reorder window</Badge>
              <Badge tone="danger">Scrape failed</Badge>
              <Badge tone="neutral">New</Badge>
              <Badge tone="brand">Growth</Badge>
              <CountBadge count={1} label="threads need a reply" />
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Card tone="invert">
              <p className="r-eyebrow" style={{ color: '#A8C3B4' }}>Returns prevented · 30d</p>
              <div style={{ fontSize: 'var(--r-text-5xl)', fontWeight: 700, letterSpacing: 'var(--r-tracking-tight)', marginTop: 6 }}>12</div>
              <p style={{ fontSize: 'var(--r-text-sm)', color: '#7FB598', margin: '4px 0 0' }}>conversations where a return was avoided</p>
            </Card>
            <Card>
              <p className="r-card-title">Knowledge health</p>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--r-text-sm-plus)', color: 'var(--r-text-secondary)' }}><span>Usage instructions</span><span style={{ fontWeight: 600 }}>92%</span></div>
                  <div style={{ marginTop: 5 }}><ProgressBar value={92} label="Usage instructions coverage" /></div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--r-text-sm-plus)', color: 'var(--r-text-secondary)' }}><span>Return-prevention tips</span><span style={{ fontWeight: 600, color: 'var(--r-warning)' }}>61%</span></div>
                  <div style={{ marginTop: 5 }}><ProgressBar value={61} label="Return-prevention tips coverage" tone="warning" /></div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <p className="r-eyebrow" style={{ marginBottom: 12 }}>Form controls</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label="Bot name" defaultValue="Recete" help="Shown to customers on WhatsApp." />
              <Input label="Notification phone" placeholder="+44 7915 922506" error="Enter a valid phone number." />
              <Select label="Default language" defaultValue="tr">
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </Select>
              <Textarea label="Welcome message" rows={3} defaultValue="Merhaba {name}! 🌿" />
            </div>
          </Card>


          <div>
            <p className="r-eyebrow" style={{ marginBottom: 10 }}>Products table (prototype data)</p>
            <ProductsTable
              products={[
                { id: 'p1', name: 'MINERAL 89 Nemlendirici Serum 50 ML', url: 'vichy.com.tr/yuz-bakimi/nemlendirici-serum', updated_at: '2026-05-21T10:00:00Z', raw_text: 'x', chunkCount: 9, knowledgeHealth: { score: 73 } },
                { id: 'p2', name: 'Hyaluronic Cleansing Gel 200 ML', url: 'oliveandoak.com/products/cleansing-gel', updated_at: '2026-07-12T10:00:00Z', raw_text: 'x', chunkCount: 14, knowledgeHealth: { score: 91 } },
                { id: 'p3', name: 'Vitamin C Booster 15 ML', url: 'oliveandoak.com/products/vit-c-booster', updated_at: '2026-07-29T10:00:00Z', chunkCount: 0, knowledgeHealth: { score: 12 } },
              ]}
              columns={{ product: 'Product', score: 'Knowledge score', status: 'Status', chunks: 'Chunks', lastScraped: 'Last scraped', actions: 'Actions' }}
              selectedIds={new Set(['p1'])}
              onToggleSelect={() => {}}
              selectLabel={(n) => `Select ${n}`}
              editLabel="Edit"
              unknownLabel="—"
              neverScrapedLabel="Not scraped"
              statusLabel={(r) => { const s = r.knowledgeHealth?.score; return s === undefined ? 'Not scored' : s >= 80 ? 'Strong' : s >= 50 ? 'At risk' : 'Needs work'; }}
              formatDate={(iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            />
          </div>
          <TableWrap>
            <table className="r-table">
              <thead>
                <tr><th>Customer</th><th>Segment</th><th>Orders</th><th>Churn risk</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name="Şebnem A" /><span className="r-table-strong">Şebnem A.</span></div></td>
                  <td><Badge tone="warning">At risk</Badge></td>
                  <td>1</td>
                  <td style={{ width: 160 }}><ProgressBar value={72} label="Churn risk 72%" tone="warning" /></td>
                </tr>
                <tr>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name="Eralp Çukurova" /><span className="r-table-strong">Eralp Çukurova</span></div></td>
                  <td><Badge tone="success">Loyal</Badge></td>
                  <td>6</td>
                  <td style={{ width: 160 }}><ProgressBar value={18} label="Churn risk 18%" /></td>
                </tr>
              </tbody>
            </table>
          </TableWrap>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Card padding="flush">
              <EmptyState
                title="No conversations yet"
                body="Threads appear here after orders flow through Recete and buyers start replying."
                action={<Button variant="primary">Set up integration</Button>}
              />
            </Card>
            <Card>
              <p className="r-eyebrow" style={{ marginBottom: 12 }}>Skeleton</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton height={28} width="60%" label="Loading metric" />
                <Skeleton label="Loading row" />
                <Skeleton label="Loading row" />
              </div>
            </Card>
          </div>
        </div>
    </Shell>
  );
}
