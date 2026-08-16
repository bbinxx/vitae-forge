import { useState, useEffect } from 'react';
import { Bookmark, Recipe } from '../types';
import { api } from '../services/api';

class ResumeStore {
  private bookmarks: Bookmark[] = [];
  private loading = false;
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

  async load() {
    this.loading = true;
    this.notify();
    try {
      const res = await api.getBookmarks();
      this.bookmarks = Array.isArray(res) ? res : res.bookmarks || [];
      localStorage.setItem('cached_bookmarks', JSON.stringify(this.bookmarks));
    } catch (e) {
      console.error('Failed to load bookmarks:', e);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async create(name: string, data: any, sourceAppId?: string): Promise<Bookmark | undefined> {
    try {
      const res = await api.createBookmark({ name, data, source_app_id: sourceAppId });
      await this.load();
      return res.bookmark;
    } catch (e: any) {
      alert('Failed to save resume: ' + e.message);
      return undefined;
    }
  }

  async update(id: string, data: Partial<Bookmark>) {
    try {
      await api.updateBookmark(id, data);
      await this.load();
    } catch (e: any) {
      alert('Failed to update resume: ' + e.message);
    }
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

  useEffect(() => {
    const unsubscribe = resumeStore.subscribe(() => {
      setBookmarks(resumeStore.getBookmarks());
      setLoading(resumeStore.isLoading());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return { bookmarks, loading, loadBookmarks: () => resumeStore.load() };
}
