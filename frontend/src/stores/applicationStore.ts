import { useState, useEffect } from 'react';
import { Application } from '../types';
import { api } from '../services/api';

class ApplicationStore {
  private applications: Application[] = [];
  private loading = false;
  private listeners = new Set<() => void>();

  constructor() {
    try {
      const cached = localStorage.getItem('cached_applications');
      if (cached) {
        this.applications = JSON.parse(cached);
      }
    } catch {}
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  getApplications() { return this.applications; }
  isLoading() { return this.loading; }

  async load() {
    this.loading = true;
    this.notify();
    try {
      const res = await api.getApplications();
      // Handle array vs wrapped object API structures
      this.applications = Array.isArray(res) ? res : res.applications || [];
      localStorage.setItem('cached_applications', JSON.stringify(this.applications));
    } catch (e) {
      console.error('Failed to load applications:', e);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async create(company: string, role: string, status: string, priority: string): Promise<Application | undefined> {
    try {
      const configRes = await api.getConfig().catch(() => ({}));
      const baseConfig = configRes.master || configRes || {};

      const res = await api.createApplication({
        company,
        role,
        status,
        priority,
        date_applied: new Date().toISOString().split('T')[0],
        resume_template: baseConfig
      });
      await this.load();
      return res.application;
    } catch (e: any) {
      alert('Failed to create application: ' + e.message);
      return undefined;
    }
  }

  async update(id: string, data: Partial<Application>) {
    try {
      await api.updateApplication(id, data);
      await this.load();
    } catch (e: any) {
      alert('Failed to update application: ' + e.message);
    }
  }

  async delete(id: string) {
    try {
      await api.deleteApplication(id);
      await this.load();
    } catch (e: any) {
      alert('Failed to delete application: ' + e.message);
    }
  }

  async bulkDelete(ids: string[]) {
    try {
      await Promise.all(ids.map(id => api.deleteApplication(id)));
      await this.load();
    } catch (e: any) {
      alert('Failed to delete applications: ' + e.message);
    }
  }

  async bulkStatusUpdate(ids: string[], status: string) {
    try {
      await Promise.all(ids.map(id => api.updateApplication(id, { status })));
      await this.load();
    } catch (e: any) {
      alert('Failed to update statuses: ' + e.message);
    }
  }
}

export const applicationStore = new ApplicationStore();

export function useApplications() {
  const [apps, setApps] = useState(applicationStore.getApplications());
  const [loading, setLoading] = useState(applicationStore.isLoading());

  useEffect(() => {
    const unsubscribe = applicationStore.subscribe(() => {
      setApps(applicationStore.getApplications());
      setLoading(applicationStore.isLoading());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return { apps, loading, loadApps: () => applicationStore.load() };
}
