# SeedCertify Frontend

Antarmuka web modern untuk platform **SeedCertify** — aplikasi sertifikasi benih perkebunan yang memadukan palet hijau, biru, dan kuning untuk nuansa segar dan profesional.

## ✨ Fitur

- **Halaman Autentikasi** (Login & Register) dengan ilustrasi informatif dan elemen glassmorphism.
- **Dashboard Ikhtisar** lengkap dengan sidebar, header responsif, kartu metrik, aktivitas terbaru, dan panel rekomendasi.
- **Tema Tailwind kustom** dengan token warna `primary`, `ocean`, dan `sunshine` untuk konsistensi visual.
- Komponen siap-integrasi seperti kartu metrik dan tata letak dashboard untuk pengembangan fitur lanjutan.

## 🧱 Teknologi

- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) (template rolldown)
- [Vue Router](https://router.vuejs.org/) untuk navigasi multi-halaman
- [Tailwind CSS 4](https://tailwindcss.com/) + plugin Forms
- [Heroicons](https://heroicons.com/) sebagai ikon SVG

## 🚀 Mulai Pengembangan

```bash
npm install
npm run dev
```

Buka browser ke URL yang ditampilkan (default `http://localhost:5173`).

## 🏗️ Skrip yang Tersedia

| Perintah        | Deskripsi                                        |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Menjalankan server pengembangan Vite             |
| `npm run build` | Membangun aplikasi untuk produksi                |
| `npm run preview` | Menjalankan build produksi secara lokal         |

## 🗂️ Struktur Sorotan

- `src/layouts/AuthLayout.vue` — tata letak halaman login/register.
- `src/layouts/DashboardLayout.vue` — kerangka dashboard lengkap dengan sidebar & topbar.
- `src/views/AuthLogin.vue` & `src/views/AuthRegister.vue` — formulir autentikasi.
- `src/views/DashboardView.vue` — contoh konten dashboard.
- `src/components/dashboard/MetricCard.vue` — kartu statistik reusable.

## 🔧 Konfigurasi Tailwind

Palet warna kustom tersedia melalui kelas `primary`, `ocean`, `sunshine`, `surface`, dan `forest`. Gunakan utilitas `glass-card`, `primary-button`, serta `input-field` untuk menjaga konsistensi gaya.

## 📄 Lisensi

Proyek internal SeedCertify. Sesuaikan ketentuan lisensi sesuai kebutuhan organisasi Anda.
