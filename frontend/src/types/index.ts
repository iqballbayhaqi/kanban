export interface User {
  id: number;
  email: string;
  name: string;
}

export interface ChecklistItem {
  id: number;
  card_id: number;
  title: string;
  is_checked: number; // 0 | 1 (SQLite)
  position: number;
  created_at: string;
}

export interface Card {
  id: number;
  title: string;
  description?: string | null;
  column_id: number;
  position: number;
  label_color?: string | null;
  due_date?: string | null;
  priority?: string | null;
  checklist_items?: ChecklistItem[];
  created_at: string;
}

export interface Column {
  id: number;
  title: string;
  board_id: number;
  position: number;
  cards: Card[];
  created_at: string;
}

export interface Habit {
  id: number;
  user_id: number;
  title: string;
  color: string;
  position: number;
  done: boolean;
  streak: number;
  miss_streak: number;
  created_at: string;
}

export interface BoardColumnCount {
  id: number;
  title: string;
  card_count: number;
}

export interface Board {
  id: number;
  title: string;
  description?: string | null;
  color: string;
  wallpaper_url?: string | null;
  user_id: number;
  columns?: Column[];
  column_counts?: BoardColumnCount[];
  created_at: string;
}
