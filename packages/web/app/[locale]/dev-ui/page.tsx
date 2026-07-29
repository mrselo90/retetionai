'use client';

import { notFound } from 'next/navigation';
import { Avatar, Badge, Button, Card, CountBadge, EmptyState, Input, ProgressBar, Select, Skeleton, TableWrap, Textarea } from '@/components/recete';

/** Internal component gallery — verifies the primitives render as designed. */
export default function DevUiPage() {
  // Internal gallery: useful while the design is being implemented, but it must
  // not exist in production as an unauthenticated route.
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="r-app">
      <div className="r-main">
        <div className="r-main-inner" style={{ paddingTop: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
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
      </div>
    </div>
  );
}
