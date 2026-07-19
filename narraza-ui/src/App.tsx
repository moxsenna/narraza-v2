import { Routes, Route, Navigate } from 'react-router-dom'
import { ModeProvider } from '@/context/mode'
import { SimProvider } from '@/context/sim'
import { AppShell } from '@/components/shell/AppShell'
import { PROJECT_ROUTES, APP_ROUTES } from '@/routes'
import LandingPage from '@/pages/Landing'
import LoginPage from '@/pages/auth/Login'
import VerifyPage from '@/pages/auth/Verify'
import AuthErrorPage from '@/pages/auth/AuthError'
import ProjectHomePage from '@/pages/app/ProjectHome'
import PlaceholderPage from '@/pages/app/PlaceholderPage'

/**
 * Peta rute Narraza v2 (prototipe).
 * Halaman bertanda PlaceholderPage akan diisi agent berikutnya;
 * navigasi sudah berfungsi ujung-ke-ujung.
 */
export default function App() {
  return (
    <ModeProvider>
      <SimProvider>
        <Routes>
          {/* Publik */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth (passwordless) */}
          <Route path="/masuk" element={<LoginPage />} />
          <Route path="/masuk/verifikasi" element={<VerifyPage />} />
          <Route path="/masuk/error" element={<AuthErrorPage />} />

          {/* Area aplikasi */}
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/proyek" replace />} />

            {/* Dashboard & mulai proyek */}
            <Route
              path="proyek"
              element={
                <PlaceholderPage
                  meta={APP_ROUTES.dashboard}
                  akanAda={[
                    'Kartu proyek aktif dengan langkah berikutnya masing-masing',
                    'Kartu "Buat Proyek Baru" dengan pilihan cara mulai',
                    'Ringkasan pemakaian kredit bulan ini',
                  ]}
                  emptyTitle="Belum ada proyek cerita"
                  emptyBody="Cerita pertamamu belum dimulai. Pilih cara mulai yang paling nyaman—dari ide kosong, premis kasar, atau draft yang sudah ada."
                />
              }
            />
            <Route
              path="proyek/baru"
              element={
                <PlaceholderPage
                  meta={APP_ROUTES.baru}
                  akanAda={[
                    'Lima jalur mulai: belum punya ide, ide kasar, punya draft, punya outline, memperbaiki cerita',
                    'Setiap kartu berisi satu kalimat penjelasan dan hasil yang akan didapat',
                  ]}
                />
              }
            />
            <Route
              path="proyek/import"
              element={
                <PlaceholderPage
                  meta={APP_ROUTES.import}
                  akanAda={[
                    'Unggah naskah dari dokumen',
                    'Narra membaca strukturnya dan mengusulkan fondasi awal',
                  ]}
                />
              }
            />

            {/* Halaman proyek */}
            <Route path="p/:projectId" element={<ProjectHomePage />} />
            <Route
              path="p/:projectId/narra"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.narra.meta}
                  akanAda={[
                    'Percakapan dengan Narra beserta rekomendasi cepat (maks. 5 pilihan)',
                    'Kartu hasil: konsep, usulan fakta, dan ringkasan ekstraksi dari obrolan',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/konsep"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.konsep.meta}
                  akanAda={[
                    'Tiga kartu konsep dengan premis, hook, dan perbedaan utama',
                    'Memilih konsep menghasilkan draf Fondasi Cerita',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/fondasi"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.fondasi.meta}
                  akanAda={[
                    'Ringkasan konsep, tokoh, konflik, dan janji pembaca',
                    'Kesiapan Fondasi: persentase, checklist unsur, satu rekomendasi berikutnya',
                    'CTA "Kunci fondasi" dengan penjelasan konsekuensi',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/karakter"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.karakter.meta}
                  akanAda={[
                    'Kartu karakter: tujuan, luka batin, ketakutan, gaya bicara',
                    'Relasi antartokoh dan aturan panggilan',
                    'Pengetahuan tokoh: apa yang sudah dan belum ia ketahui',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/fakta"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.fakta.meta}
                  akanAda={[
                    'Daftar fakta per status: terkunci, usulan, ditolak, digantikan, bertentangan',
                    'Kartu Usulan Narra dengan dampak dan tingkat risiko',
                    'Usulan berisiko tinggi memerlukan tinjauan ekstra sebelum dikunci',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/outline"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.outline.meta}
                  akanAda={[
                    'Roadmap 10 bab dengan status per bab',
                    'Detail arahan adegan: hook pembuka, open loop, kemenangan kecil, hook penutup',
                    'Badge Rahasia Ditahan dan batasan yang belum boleh dibuka',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/rahasia"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.rahasia.meta}
                  akanAda={[
                    'Linimasa kapan setiap rahasia terbuka',
                    'Siapa yang memegang rahasia dan siapa yang sudah boleh tahu',
                    'Peringatan bila adegan terlalu dekat dengan jawaban rahasia',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/tulis/:chapterId"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.tulis.meta}
                  akanAda={[
                    'Editor prosa nyaman dibaca dengan status simpan otomatis',
                    'Arahan adegan di panel samping, tidak menutup teks',
                    'Bandingkan versi: Dibuat Narra, Diedit kamu, Versi diterima',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/cek"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.cek.meta}
                  akanAda={[
                    'Hasil Cek Cerita: lolos, peringatan, dan penghambat dengan bahasa manfaat',
                    'Detail teknis tersedia lewat "Lihat alasan"',
                    'Saran perbaikan yang bisa langsung diterapkan',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/tutup-bab/:chapterId"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.tutupBab.meta}
                  akanAda={[
                    'Ringkasan Perubahan Setelah Bab: fakta baru, perubahan tokoh, open loop',
                    'Konfirmasi penutupan bab menjadi bagian Cerita Resmi',
                  ]}
                />
              }
            />
            <Route
              path="p/:projectId/publish/:chapterId"
              element={
                <PlaceholderPage
                  meta={PROJECT_ROUTES.publish.meta}
                  akanAda={[
                    'Judul, teaser, caption, comment bait, dan tags yang siap disalin',
                    'Pratinjau tampilan bab di HP pembaca',
                    'Checklist kesiapan publish',
                  ]}
                />
              }
            />

            {/* Akun */}
            <Route
              path="pengaturan"
              element={
                <PlaceholderPage
                  meta={APP_ROUTES.pengaturan}
                  akanAda={[
                    'Profil dan email akun',
                    'Preferensi menulis dan mode tampilan bawaan',
                    'Pengelolaan proyek dan penghapusan akun',
                  ]}
                />
              }
            />
            <Route
              path="kredit"
              element={
                <PlaceholderPage
                  meta={APP_ROUTES.kredit}
                  akanAda={[
                    'Saldo tersedia, tertahan, dan sedang direkonsiliasi',
                    'Riwayat kredit: pemberian, penahanan, penyelesaian, pengembalian',
                    'Pembelian kredit (segera hadir)',
                  ]}
                />
              }
            />

            <Route path="*" element={<Navigate to="/app/proyek" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SimProvider>
    </ModeProvider>
  )
}
