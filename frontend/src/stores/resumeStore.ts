import { useState, useEffect } from 'react';
import { Bookmark, Recipe } from '../types';
import { api } from '../services/api';

class ResumeStore {
  private bookmarks: Bookmark[] = [];
  private loading = true;
  private error = "";
  private listeners = new Set<() => void>();

  constructor() {
    try {
      const cached = localStorage.getItem('cached_bookmarks');
      if (cached) {
        this.bookmarks = JSON.parse(cached);
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

  getBookmarks() { return this.bookmarks; }
  isLoading() { return this.loading; }
  getError() { return this.error; }

  reset() {
    this.bookmarks = [];
    this.error = '';
    this.loading = true;
    this.notify();
  }

  async load() {
    this.loading = true;
    this.error = '';
    this.notify();
    try {
      const res = await api.getBookmarks();
      this.bookmarks = Array.isArray(res) ? res : res.bookmarks || [];
      localStorage.setItem('cached_bookmarks', JSON.stringify(this.bookmarks));
    } catch (e) {
      this.error = "Could not load saved resumes.";
      console.error('Failed to load bookmarks:', e);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async create(name: string, data: any, sourceAppId?: string): Promise<Bookmark> {
    const res = await api.createBookmark({ name, data, source_app_id: sourceAppId });
    await this.load();
    return res.bookmark;
  }

  async update(id: string, data: Partial<Bookmark>) {
    const existing = this.bookmarks.find(bookmark => bookmark.id === id);
    await api.updateBookmark(id, {
      name: data.name ?? existing?.name ?? '',
      data: data.data ?? existing?.data ?? {},
    });
    await this.load();
  }

  async delete(id: string) {
    try {
      await api.deleteBookmark(id);
      await this.load();
    } catch (e: any) {
      alert('Failed to delete resume: ' + e.message);
    }
  }

  async clone(bookmark: Bookmark) {
    const cloneName = `${bookmark.name} - Copy`;
    try {
      await api.createBookmark({
        name: cloneName,
        data: bookmark.data,
        source_app_id: bookmark.source_app_id
      });
      await this.load();
    } catch (e: any) {
      alert('Failed to duplicate resume: ' + e.message);
    }
  }
}

export const resumeStore = new ResumeStore();

export function useResumes() {
  const [bookmarks, setBookmarks] = useState(resumeStore.getBookmarks());
  const [loading, setLoading] = useState(resumeStore.isLoading());
  const [error, setError] = useState(resumeStore.getError());

  useEffect(() => {
    const unsubscribe = resumeStore.subscribe(() => {
      setBookmarks(resumeStore.getBookmarks());
      setLoading(resumeStore.isLoading());
      setError(resumeStore.getError());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return { bookmarks, loading, error, loadBookmarks: () => resumeStore.load() };
}
