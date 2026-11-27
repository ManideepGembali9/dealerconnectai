'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  approveDbDealerApplication,
  getDbDealerApplications,
  rejectDbDealerApplication,
  updateDbDealerApplicationStatus,
} from '@/lib/firebase-db';
import { timeAgo } from '@/lib/format';
import type { Dealer,DealerApplication } from '@/lib/types';
import {
  AlertCircle,
  Building,
  Check,
  Eye,
  FileText,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Truck,
  X
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { toast } from 'sonner';

type Module02Props = {
  dealers: Dealer[];
  onUpdateDealerStatus: (id: string, status: Dealer['status']) => Promise<void>;
  onDeleteDealer: (id: string) => Promise<void>;
};

export function Module02Dealers({ dealers, onUpdateDealerStatus, onDeleteDealer }: Module02Props) {
  // Top Level Tab: "applications" vs "showrooms"
  const [activeSubTab, setActiveSubTab] = useState<'applications' | 'showrooms'>('applications');

  // Applications Data State
  const [applications, setApplications] = useState<DealerApplication[]>([]);
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('all');
  const [appSearch, setAppSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<DealerApplication | null>(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [appActionLoading, setAppActionLoading] = useState(false);

  // Showrooms Directory State
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'suspended' | 'blocked'>('all');
  const [search, setSearch] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dealer | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load Dealer Applications
  const loadApplications = useCallback(async () => {
    try {
      const apps = await getDbDealerApplications();
      setApplications(apps);
    } catch (err) {
      console.warn('Failed to load dealer applications:', err);
    }
  }, []);

  useEffect(() => {
    loadApplications();

    const handleSync = () => loadApplications();
    window.addEventListener('storage', handleSync);
    window.addEventListener('dc-sync-event', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('dc-sync-event', handleSync);
    };
  }, [loadApplications]);

  // Filtered Applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      if (appStatusFilter !== 'all' && app.status !== appStatusFilter) return false;
      if (appSearch) {
        const q = appSearch.toLowerCase();
        const matchId = app.id.toLowerCase().includes(q);
        const matchShop = app.shop_name.toLowerCase().includes(q);
        const matchOwner = app.owner_name.toLowerCase().includes(q);
        const matchCity = app.city.toLowerCase().includes(q);
        const matchPin = app.pin_code.includes(q);
        const matchPhone = app.phone.includes(q);
        const matchEmail = app.email.toLowerCase().includes(q);
        if (!matchId && !matchShop && !matchOwner && !matchCity && !matchPin && !matchPhone && !matchEmail) {
          return false;
        }
      }
      return true;
    });
  }, [applications, appStatusFilter, appSearch]);

  const pendingAppsCount = useMemo(() => {
    return applications.filter((a) => a.status === 'pending' || a.status === 'under_review').length;
  }, [applications]);

  // Filtered Existing Dealers
  const filteredDealers = useMemo(() => {
    return dealers.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = d.shop_name.toLowerCase().includes(q);
        const matchOwner = d.owner_name.toLowerCase().includes(q);
        const matchCity = d.city.toLowerCase().includes(q);
        const matchPin = d.pin_code.includes(q);
        const matchEmail = d.email.toLowerCase().includes(q);
        if (!matchName && !matchOwner && !matchCity && !matchPin && !matchEmail) return false;
      }
      return true;
    });
  }, [dealers, statusFilter, search]);

  const dealerCounts = useMemo(() => {
    return {
      all: dealers.length,
      pending: dealers.filter((d) => d.status === 'pending').length,
      approved: dealers.filter((d) => d.status === 'approved').length,
      suspended: dealers.filter((d) => d.status === 'suspended' || d.status === 'blocked').length,
    };
  }, [dealers]);

  // Approve Application Handler
  const handleApproveApplication = async (appId: string) => {
    setAppActionLoading(true);
    try {
      const remarks = adminRemarks.trim() || 'Approved by Administrator. Welcome to DealerConnect AI Merchant Console!';
      const res = await approveDbDealerApplication(appId, remarks);
      if (res.success) {
        toast.success(`Dealership Application ${appId} Approved! Account activated.`);
        setSelectedApp(null);
        setAdminRemarks('');
        setShowRejectInput(false);
        await loadApplications();
      } else {
        toast.error(res.error || 'Failed to approve application');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Approval failed');
    } finally {
      setAppActionLoading(false);
    }
  };

  // Reject Application Handler
  const handleRejectApplication = async (appId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please enter the reason for rejecting this application.');
      return;
    }

    setAppActionLoading(true);
    try {
      const res = await rejectDbDealerApplication(appId, rejectionReason.trim());
      if (res.success) {
        toast.success(`Application ${appId} rejected.`);
        setSelectedApp(null);
        setRejectionReason('');
        setShowRejectInput(false);
        await loadApplications();
      } else {
        toast.error(res.error || 'Failed to reject application');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Rejection failed');
    } finally {
      setAppActionLoading(false);
    }
  };

  // Mark Under Review
  const handleMarkUnderReview = async (appId: string) => {
    setAppActionLoading(true);
    try {
      await updateDbDealerApplicationStatus(appId, 'under_review', 'Application documents are currently under verification.');
      toast.success(`Application ${appId} marked as Under Review.`);
      if (selectedApp) {
        setSelectedApp((prev) => (prev ? { ...prev, status: 'under_review' } : null));
      }
      await loadApplications();
    } catch (err: any) {
      toast.error('Failed to update status');
    } finally {
      setAppActionLoading(false);
    }
  };

  // Existing Dealer Handlers
  const handleStatusChange = async (id: string, newStatus: Dealer['status']) => {
    setActionLoading(true);
    try {
      await onUpdateDealerStatus(id, newStatus);
      toast.success(`Dealer status updated to "${newStatus}"`);
      if (selectedDealer && selectedDealer.id === id) {
        setSelectedDealer((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch {
      toast.error('Failed to update dealer status');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await onDeleteDealer(deleteTarget.id);
      toast.success(`Dealership "${deleteTarget.shop_name}" deleted.`);
      setDeleteTarget(null);
      if (selectedDealer?.id === deleteTarget.id) setSelectedDealer(null);
    } catch {
      toast.error('Failed to delete dealer');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Store className="h-7 w-7 text-primary" /> Dealer Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Review dealer applications, verify merchant credentials, and manage active showrooms
          </p>
        </div>

        {pendingAppsCount > 0 && (
          <Badge variant="destructive" className="px-3 py-1 text-xs font-bold gap-1.5 self-start sm:self-auto">
            <AlertCircle className="h-3.5 w-3.5" /> {pendingAppsCount} Pending Verification
          </Badge>
        )}
      </div>

      {/* TOP NAVIGATION SUB-TABS: Applications vs Directory */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveSubTab('applications')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'applications'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4" />
          Dealer Applications
          {pendingAppsCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">
              {pendingAppsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('showrooms')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'showrooms'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building className="h-4 w-4" />
          Active Showrooms Directory ({dealers.length})
        </button>
      </div>

      {/* ============================================================= */}
      {/* VIEW 1: DEALER APPLICATIONS MODULE                            */}
      {/* ============================================================= */}
      {activeSubTab === 'applications' && (
        <div className="space-y-4">
          {/* Applications Filter & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={appStatusFilter}
              onValueChange={(v: any) => setAppStatusFilter(v)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-5 w-full sm:w-auto h-9">
                <TabsTrigger value="all" className="text-xs font-semibold">
                  All ({applications.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs font-semibold">
                  Pending ({applications.filter((a) => a.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger value="under_review" className="text-xs font-semibold">
                  Review ({applications.filter((a) => a.status === 'under_review').length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="text-xs font-semibold">
                  Approved ({applications.filter((a) => a.status === 'approved').length})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="text-xs font-semibold">
                  Rejected ({applications.filter((a) => a.status === 'rejected').length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ID, shop, owner, PIN..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Mobile Cards View (< 768px) */}
          <div className="md:hidden space-y-2.5">
            {filteredApps.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
                <FileText className="mx-auto h-7 w-7 opacity-40 mb-1.5" />
                No dealership applications match your search criteria.
              </Card>
            ) : (
              filteredApps.map((app) => (
                <Card key={app.id} className="p-4 border-border/80 rounded-2xl space-y-2.5 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-bold text-primary block">{app.id}</span>
                      <h3 className="text-sm font-black text-foreground truncate">{app.shop_name}</h3>
                      <p className="text-[11px] text-muted-foreground">{app.owner_name} • {app.city}, {app.pin_code}</p>
                    </div>
                    <Badge className="text-[10px] font-bold shrink-0 capitalize">
                      {app.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                    <span className="text-muted-foreground font-mono truncate">{app.phone}</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedApp(app);
                        setAdminRemarks(app.admin_remarks || '');
                        setRejectionReason(app.rejection_reason || '');
                        setShowRejectInput(false);
                      }}
                      className="h-8 px-3 text-xs font-bold bg-primary text-primary-foreground rounded-xl shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Review
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Applications Table Card (>= 768px) */}
          <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Application ID & Shop</th>
                    <th className="px-4 py-3">Owner Contact</th>
                    <th className="px-4 py-3">Location & Delivery</th>
                    <th className="px-4 py-3">Date Submitted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        <FileText className="mx-auto h-8 w-8 opacity-40 mb-2" />
                        No dealership applications match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((app) => (
                      <tr key={app.id} className="hover:bg-muted/20 transition-colors">
                        {/* ID & Shop */}
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-primary text-xs">{app.id}</div>
                          <div className="font-bold text-foreground text-xs sm:text-sm">{app.shop_name}</div>
                          {app.gst_number && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              GST: {app.gst_number}
                            </span>
                          )}
                        </td>

                        {/* Owner Contact */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-foreground">{app.owner_name}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {app.phone}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                            <Mail className="h-3 w-3" /> {app.email}
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary shrink-0" />
                            {app.city}, PIN {app.pin_code}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {app.home_delivery_radius_km} km radius • {app.delivery_available ? 'Delivery' : 'Pickup only'}
                          </div>
                        </td>

                        {/* Submission Date */}
                        <td className="px-4 py-3.5 text-muted-foreground text-[11px]">
                          {timeAgo(app.created_at)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          {app.status === 'approved' && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                              Approved
                            </Badge>
                          )}
                          {app.status === 'pending' && (
                            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] font-bold">
                              Pending
                            </Badge>
                          )}
                          {app.status === 'under_review' && (
                            <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] font-bold">
                              Under Review
                            </Badge>
                          )}
                          {app.status === 'rejected' && (
                            <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-[10px] font-bold">
                              Rejected
                            </Badge>
                          )}
                          {app.status === 'more_info_required' && (
                            <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px] font-bold">
                              Info Required
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedApp(app);
                              setAdminRemarks(app.admin_remarks || '');
                              setRejectionReason(app.rejection_reason || '');
                              setShowRejectInput(false);
                            }}
                            className="h-8 px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Review Application
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/* VIEW 2: ACTIVE SHOWROOMS DIRECTORY                            */}
      {/* ============================================================= */}
      {activeSubTab === 'showrooms' && (
        <div className="space-y-4">
          {/* Filter Tabs and Search Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={statusFilter}
              onValueChange={(v: any) => setStatusFilter(v)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-4 w-full sm:w-auto h-9">
                <TabsTrigger value="all" className="text-xs font-semibold">
                  All ({dealerCounts.all})
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs font-semibold">
                  Pending ({dealerCounts.pending})
                </TabsTrigger>
                <TabsTrigger value="approved" className="text-xs font-semibold">
                  Approved ({dealerCounts.approved})
                </TabsTrigger>
                <TabsTrigger value="suspended" className="text-xs font-semibold">
                  Suspended ({dealerCounts.suspended})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shop, owner, PIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Mobile Showrooms Cards (< 768px) */}
          <div className="md:hidden space-y-2.5">
            {filteredDealers.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
                <Store className="mx-auto h-7 w-7 opacity-40 mb-1.5" />
                No dealerships match your filter criteria.
              </Card>
            ) : (
              filteredDealers.map((d) => (
                <Card key={d.id} className="p-4 border-border/80 rounded-2xl space-y-2.5 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-foreground truncate">{d.shop_name}</h3>
                      <p className="text-[11px] text-muted-foreground">Owner: {d.owner_name}</p>
                      <p className="text-[11px] text-muted-foreground">{d.city}, PIN {d.pin_code}</p>
                    </div>
                    <Badge
                      variant={d.status === 'approved' ? 'default' : d.status === 'pending' ? 'secondary' : 'destructive'}
                      className="text-[10px] capitalize font-bold shrink-0"
                    >
                      {d.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                    <Button size="sm" variant="outline" onClick={() => setSelectedDealer(d)} className="h-8 px-2.5 text-[11px] font-semibold rounded-lg">
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    {d.status === 'pending' && (
                      <>
                        <Button size="sm" disabled={actionLoading} onClick={() => handleStatusChange(d.id, 'approved')} className="h-8 px-2.5 text-[11px] font-bold bg-emerald-600 text-white rounded-lg">
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" disabled={actionLoading} onClick={() => handleStatusChange(d.id, 'blocked')} className="h-8 px-2.5 text-[11px] font-semibold rounded-lg">
                          <X className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {d.status === 'approved' && (
                      <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => handleStatusChange(d.id, 'suspended')} className="h-8 px-2.5 text-[11px] text-amber-600 rounded-lg">
                        Suspend
                      </Button>
                    )}
                    {(d.status === 'suspended' || d.status === 'blocked') && (
                      <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => handleStatusChange(d.id, 'approved')} className="h-8 px-2.5 text-[11px] text-emerald-600 rounded-lg">
                        Reinstate
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Dealers Table Card (>= 768px) */}
          <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Shop & Owner</th>
                    <th className="px-4 py-3">Location & PIN</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Catalog / Activity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Verification Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredDealers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        <Store className="mx-auto h-8 w-8 opacity-40 mb-2" />
                        No dealerships match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDealers.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                        {/* Shop & Owner */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                              {d.shop_name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-foreground text-xs sm:text-sm">
                                {d.shop_name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                Owner: <span className="font-medium text-foreground">{d.owner_name}</span>
                              </div>
                              {d.gst_number && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  GST: {d.gst_number}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3.5">
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary shrink-0" />
                            {d.city}, {d.state}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            PIN: <span className="font-semibold text-foreground">{d.pin_code}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-[200px]">
                            {d.address}
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3.5">
                          <div className="text-[11px] text-foreground font-medium flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" /> {d.phone}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" /> {d.email}
                          </div>
                        </td>

                        {/* Activity */}
                        <td className="px-4 py-3.5">
                          <div className="text-[11px] font-semibold text-foreground">
                            {d.product_count ?? 0} Products
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            ⭐ {d.rating ? d.rating.toFixed(1) : 'New'} ({d.rating_count ?? 0} reviews)
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <Badge
                            variant={
                              d.status === 'approved'
                                ? 'default'
                                : d.status === 'pending'
                                ? 'secondary'
                                : 'destructive'
                            }
                            className="text-[10px] capitalize font-bold"
                          >
                            {d.status}
                          </Badge>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {timeAgo(d.created_at)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDealer(d)}
                            className="h-8 px-2 text-[11px] font-semibold rounded-lg"
                            title="View Dealer Details"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>

                          {d.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                disabled={actionLoading}
                                onClick={() => handleStatusChange(d.id, 'approved')}
                                className="h-8 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                              >
                                <Check className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={actionLoading}
                                onClick={() => handleStatusChange(d.id, 'blocked')}
                                className="h-8 px-2 text-[11px] font-semibold rounded-lg"
                              >
                                <X className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}

                          {d.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actionLoading}
                              onClick={() => handleStatusChange(d.id, 'suspended')}
                              className="h-8 px-2 text-[11px] text-amber-600 hover:text-amber-700 rounded-lg"
                            >
                              Suspend
                            </Button>
                          )}

                          {(d.status === 'suspended' || d.status === 'blocked') && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading}
                              onClick={() => handleStatusChange(d.id, 'approved')}
                              className="h-8 px-2 text-[11px] text-emerald-600 font-semibold rounded-lg"
                            >
                              Reinstate
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={actionLoading}
                            onClick={() => setDeleteTarget(d)}
                            className="h-8 px-1.5 text-[11px] text-muted-foreground hover:text-destructive rounded-lg"
                            title="Delete Dealer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/* APPLICATION REVIEW MODAL                                      */}
      {/* ============================================================= */}
      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        {selectedApp && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedApp.id}
                </Badge>
                <Badge
                  className={
                    selectedApp.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                      : selectedApp.status === 'rejected'
                      ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                  }
                >
                  {selectedApp.status.toUpperCase()}
                </Badge>
              </div>
              <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2 mt-1">
                <Store className="h-5 w-5 text-primary" /> {selectedApp.shop_name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Submitted {timeAgo(selectedApp.created_at)} • Review shop credentials and verify fulfillment.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Owner & Contact Card */}
              <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/30 space-y-2">
                <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Owner & Contact Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Owner / Contact:</span>{' '}
                    <strong className="text-foreground">{selectedApp.owner_name}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mobile Phone:</span>{' '}
                    <strong className="text-foreground">{selectedApp.phone}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Login Email:</span>{' '}
                    <strong className="text-foreground font-mono">{selectedApp.email}</strong>
                  </div>
                  {selectedApp.gst_number && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">GST Number:</span>{' '}
                      <strong className="font-mono text-foreground">{selectedApp.gst_number}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Location Card */}
              <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/30 space-y-2">
                <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <MapPin className="h-4 w-4 text-primary" /> Shop Address & GPS Location
                </h4>
                <p className="text-[11px] text-foreground leading-relaxed">
                  {selectedApp.address}, {selectedApp.city}, {selectedApp.district}, {selectedApp.state} -{' '}
                  <strong className="font-mono">{selectedApp.pin_code}</strong>
                </p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                  <span>GPS Lat: {selectedApp.map_lat}</span>
                  <span>GPS Lng: {selectedApp.map_lng}</span>
                </div>
              </div>

              {/* Delivery & Fulfillment Card */}
              <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/30 space-y-2">
                <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <Truck className="h-4 w-4 text-primary" /> Delivery & Service Radius
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Home Delivery:</span>{' '}
                    <strong className="text-foreground">
                      {selectedApp.delivery_available ? 'Available' : 'Not Available'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delivery Radius:</span>{' '}
                    <strong className="text-foreground">{selectedApp.home_delivery_radius_km} km</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Store Pickup:</span>{' '}
                    <strong className="text-foreground">
                      {selectedApp.pickup_available ? 'Supported' : 'Not Supported'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Existing Remarks / Rejection Info */}
              {selectedApp.admin_remarks && (
                <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs">
                  <span className="font-bold text-foreground block mb-0.5">Admin Remarks</span>
                  <p className="text-muted-foreground text-[11px]">{selectedApp.admin_remarks}</p>
                </div>
              )}

              {/* Rejection Input Box (if user clicked Reject) */}
              {showRejectInput ? (
                <div className="p-3 rounded-2xl border border-destructive/40 bg-destructive/5 space-y-2">
                  <Label className="text-xs font-bold text-destructive">
                    Reason for Rejecting Application *
                  </Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Invalid shop registration documents or unverifiable contact number."
                    className="text-xs rounded-xl h-20"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRejectInput(false)}
                      className="text-xs rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={appActionLoading || !rejectionReason.trim()}
                      onClick={() => handleRejectApplication(selectedApp.id)}
                      className="text-xs font-bold rounded-xl"
                    >
                      Confirm Rejection
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-xs font-bold text-foreground mb-1 block">
                    Optional Approval Remarks
                  </Label>
                  <Input
                    value={adminRemarks}
                    onChange={(e) => setAdminRemarks(e.target.value)}
                    placeholder="e.g. Verified license documents. Approved for electronics category."
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-border/50 pt-3">
              {selectedApp.status !== 'approved' && !showRejectInput && (
                <>
                  <Button
                    type="button"
                    disabled={appActionLoading}
                    onClick={() => handleApproveApplication(selectedApp.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm h-10 px-4 gap-1.5"
                  >
                    <Check className="h-4 w-4" /> Approve & Activate Dealership
                  </Button>
                  {selectedApp.status === 'pending' && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={appActionLoading}
                      onClick={() => handleMarkUnderReview(selectedApp.id)}
                      className="rounded-xl text-xs h-10 font-bold"
                    >
                      Mark Under Review
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={appActionLoading}
                    onClick={() => setShowRejectInput(true)}
                    className="rounded-xl text-xs h-10 font-bold"
                  >
                    Reject Application
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedApp(null)}
                className="rounded-xl text-xs h-10"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Showroom Details Modal */}
      <Dialog open={!!selectedDealer} onOpenChange={(open) => !open && setSelectedDealer(null)}>
        {selectedDealer && (
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                <Store className="h-5 w-5 text-primary" /> {selectedDealer.shop_name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Dealership ID: {selectedDealer.id} • Registered {timeAgo(selectedDealer.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/80 p-3 bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Owner</span>
                  <p className="text-sm font-bold mt-0.5">{selectedDealer.owner_name}</p>
                </div>
                <div className="rounded-xl border border-border/80 p-3 bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
                  <div className="mt-1">
                    <Badge
                      variant={selectedDealer.status === 'approved' ? 'default' : 'secondary'}
                      className="text-xs capitalize"
                    >
                      {selectedDealer.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 p-3 space-y-2">
                <div className="font-bold text-foreground">Contact & Address Details</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Phone:</span> {selectedDealer.phone}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span> {selectedDealer.email}
                  </div>
                  <div>
                    <span className="text-muted-foreground">WhatsApp:</span>{' '}
                    {selectedDealer.whatsapp || 'Not configured'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">GST:</span>{' '}
                    {selectedDealer.gst_number || 'N/A'}
                  </div>
                </div>
                <div className="text-[11px] pt-1">
                  <span className="text-muted-foreground">Full Address:</span> {selectedDealer.address},{' '}
                  {selectedDealer.city}, {selectedDealer.state} - {selectedDealer.pin_code}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-border/50 pt-3">
              <Button variant="ghost" onClick={() => setSelectedDealer(null)} className="rounded-xl text-xs">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dealership?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.shop_name}&quot;? This will permanently
              remove this dealer and unassign all related store listings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground rounded-xl">
              Delete Dealer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
