import { useRef, useState } from 'react';
import api from '../api';

const COLORS = [
  '#0079bf','#d29034','#519839','#b04632',
  '#89609e','#cd5a91','#4bbf6b','#00aecc','#838c91',
];

const GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fd7043,#ffb74d)',
  'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
  'linear-gradient(160deg,#0093E9,#80D0C7)',
  'linear-gradient(135deg,#1a237e,#3949ab)',
  'linear-gradient(135deg,#004d40,#00897b)',
  'linear-gradient(135deg,#37474f,#78909c)',
  'linear-gradient(135deg,#880e4f,#e91e63)',
  'linear-gradient(135deg,#e65100,#ff9800)',
  'linear-gradient(135deg,#1b5e20,#66bb6a)',
  'linear-gradient(135deg,#4a148c,#9c27b0)',
];

const PHOTOS = [
  { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=75', label: 'Mountains' },
  { url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=900&q=75', label: 'Forest' },
  { url: 'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=900&q=75', label: 'Lake' },
  { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=75', label: 'Night sky' },
  { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=900&q=75', label: 'Forest path' },
  { url: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=900&q=75', label: 'Flowers' },
  { url: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=900&q=75', label: 'Beach' },
  { url: 'https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=900&q=75', label: 'Sunset' },
  { url: 'https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?w=900&q=75', label: 'Desert' },
  { url: 'https://images.unsplash.com/photo-1480497490787-505ec8cae547?w=900&q=75', label: 'Waterfall' },
  { url: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=900&q=75', label: 'Volcano' },
  { url: 'https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?w=900&q=75', label: 'Aurora' },
];

// Gambar dikecilkan dulu di browser: sisi terpanjang maks 1920px, JPEG, target < 900KB
// (nginx produksi memakai batas body default 1MB).
const MAX_SIDE = 1920;
const MAX_BYTES = 900 * 1024;

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.75, 0.65, 0.5, 0.4]) {
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error('Image is too large even after compression');
}

type Tab = 'colors' | 'gradients' | 'photos' | 'custom';

interface Props {
  color: string;
  wallpaperUrl: string;
  onColorChange: (c: string) => void;
  onWallpaperChange: (w: string) => void;
  boardTitle?: string;
}

function getBgStyle(color: string, wallpaperUrl: string): React.CSSProperties {
  if (!wallpaperUrl) return { background: color };
  if (wallpaperUrl.includes('gradient')) return { background: wallpaperUrl };
  return { backgroundImage: `url(${wallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

export default function WallpaperPicker({ color, wallpaperUrl, onColorChange, onWallpaperChange, boardTitle = 'My Board' }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    if (wallpaperUrl?.includes('gradient')) return 'gradients';
    if (wallpaperUrl?.startsWith('/api/uploads/')) return 'custom';
    if (wallpaperUrl && !wallpaperUrl.includes('gradient')) return 'photos';
    return 'colors';
  });
  const [customUrl, setCustomUrl] = useState('');
  const [customPreviewOk, setCustomPreviewOk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError('');
    if (!file.type.startsWith('image/')) { setUploadError('Please choose an image file'); return; }
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const { data } = await api.post<{ url: string }>('/uploads', blob, { headers: { 'Content-Type': 'image/jpeg' } });
      onWallpaperChange(data.url);
    } catch (e: any) {
      setUploadError(e?.response?.data?.error || e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectColor = (c: string) => { onColorChange(c); onWallpaperChange(''); };
  const selectWallpaper = (w: string) => { onWallpaperChange(w); };

  const applyCustom = () => {
    if (!customUrl.trim()) return;
    onWallpaperChange(customUrl.trim());
    setCustomUrl('');
    setCustomPreviewOk(false);
  };

  const isActive = (val: string, isColor = false) =>
    isColor ? (color === val && !wallpaperUrl) : wallpaperUrl === val;

  return (
    <div className="wp">
      {/* Live preview */}
      <div className="wp-preview" style={getBgStyle(color, wallpaperUrl)}>
        <div className="wp-preview-overlay" />
        <div className="wp-preview-col">
          <div className="wp-preview-colhead">{boardTitle}</div>
          <div className="wp-preview-card" />
          <div className="wp-preview-card wp-preview-card-sm" />
        </div>
        <div className="wp-preview-col wp-preview-col2">
          <div className="wp-preview-colhead">In Progress</div>
          <div className="wp-preview-card" />
        </div>
      </div>

      {/* Tabs */}
      <div className="wp-tabs">
        {(['colors','gradients','photos','custom'] as Tab[]).map(t => (
          <button key={t} className={`wp-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'colors' ? 'Colors' : t === 'gradients' ? 'Gradients' : t === 'photos' ? 'Photos' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Colors */}
      {tab === 'colors' && (
        <div className="wp-grid">
          {COLORS.map(c => (
            <button
              key={c}
              className={`wp-swatch ${isActive(c, true) ? 'wp-active' : ''}`}
              style={{ background: c }}
              onClick={() => selectColor(c)}
              title={c}
            />
          ))}
        </div>
      )}

      {/* Gradients */}
      {tab === 'gradients' && (
        <div className="wp-grid wp-grid-lg">
          {GRADIENTS.map((g, i) => (
            <button
              key={i}
              className={`wp-swatch wp-swatch-lg ${isActive(g) ? 'wp-active' : ''}`}
              style={{ background: g }}
              onClick={() => selectWallpaper(g)}
            />
          ))}
        </div>
      )}

      {/* Photos */}
      {tab === 'photos' && (
        <div className="wp-grid wp-grid-photos">
          {PHOTOS.map((p, i) => (
            <button
              key={i}
              className={`wp-photo ${isActive(p.url) ? 'wp-active' : ''}`}
              style={{ backgroundImage: `url(${p.url})` }}
              title={p.label}
              onClick={() => selectWallpaper(p.url)}
            />
          ))}
        </div>
      )}

      {/* Custom URL */}
      {tab === 'custom' && (
        <div className="wp-custom">
          <p className="wp-custom-hint">Upload an image from your device</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn-secondary btn-sm wp-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Upload from device'}
          </button>
          {uploadError && <p className="wp-upload-error">{uploadError}</p>}

          <p className="wp-custom-hint" style={{ marginTop: 4 }}>Or paste any image URL</p>
          <div className="wp-custom-row">
            <input
              type="text"
              value={customUrl}
              onChange={e => { setCustomUrl(e.target.value); setCustomPreviewOk(false); }}
              placeholder="https://example.com/photo.jpg"
              onKeyDown={e => e.key === 'Enter' && applyCustom()}
            />
            <button className="btn-primary btn-sm" onClick={applyCustom} disabled={!customUrl.trim()}>
              Apply
            </button>
          </div>
          {customUrl && (
            <div
              className="wp-custom-preview"
              style={{ backgroundImage: `url(${customUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              {!customPreviewOk && (
                <img
                  src={customUrl} alt="" style={{ display: 'none' }}
                  onLoad={() => setCustomPreviewOk(true)}
                  onError={() => setCustomPreviewOk(false)}
                />
              )}
              {!customPreviewOk && <span className="wp-custom-hint" style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>Loading preview…</span>}
            </div>
          )}
          {wallpaperUrl && !wallpaperUrl.includes('gradient') && (
            <button className="btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => onWallpaperChange('')}>
              Remove photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
