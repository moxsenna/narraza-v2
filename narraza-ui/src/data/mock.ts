/**
 * Narraza v2 — mock data bersama (prototype, tanpa backend).
 *
 * File ini adalah tulang punggung untuk SEMUA halaman. Agent berikutnya
 * harus membaca dari sini, bukan membuat data baru yang duplikatif.
 * Proyek contoh utama: "Rumah yang Menunggu Hujan" (drama keluarga, romance-luka).
 */
import type {
  Activity,
  ChapterDelta,
  ChapterOutline,
  Character,
  ChatMessage,
  Concept,
  CreditEntry,
  CreditSummary,
  Fact,
  Foundation,
  Project,
  ProjectProgress,
  ProseVersion,
  PublishPackage,
  RevealEntry,
  Tier,
  ValidatorFinding,
} from '@/types/story'

// ============================================================
// Proyek
// ============================================================

export const mainProject: Project = {
  id: 'rumah-hujan',
  judul: 'Rumah yang Menunggu Hujan',
  genre: 'Drama Keluarga · Romance Luka',
  deskripsi:
    'Laras kembali ke rumah mertuanya setelah dua tahun merantau, dan menemukan pernikahannya ternyata menyimpan perjanjian yang tidak pernah ia tandatangani.',
  stage: 'rencana',
  kesiapanFondasi: 82,
  babTerencana: 10,
  babTertulis: 2,
  targetBab: 40,
  faktaTerkunci: 12,
  usulanMenunggu: 3,
  diperbarui: '2 jam lalu',
  warnaAksen: 'rose',
}

export const otherProjects: Project[] = [
  {
    id: 'lentera-pagi',
    judul: 'Lentera di Ujung Pagi',
    genre: 'Inspiratif Bangkit',
    deskripsi:
      'Seorang mantan guru honorer membangun sekolah kecil di kampung halamannya sambil merawat ayahnya yang pikun.',
    stage: 'fondasi',
    kesiapanFondasi: 46,
    babTerencana: 0,
    babTertulis: 0,
    targetBab: 30,
    faktaTerkunci: 4,
    usulanMenunggu: 1,
    diperbarui: 'Kemarin',
    warnaAksen: 'amber',
  },
  {
    id: 'kost-lima',
    judul: 'Kost Nomor Lima',
    genre: 'Misteri Keluarga',
    deskripsi:
      'Lima penghuni kost yang saling asing dipaksa bekerja sama ketika menemukan surat-surat lama pemilik rumah yang hilang dua puluh tahun lalu.',
    stage: 'menulis',
    kesiapanFondasi: 100,
    babTerencana: 10,
    babTertulis: 6,
    targetBab: 35,
    faktaTerkunci: 18,
    usulanMenunggu: 0,
    diperbarui: '3 hari lalu',
    warnaAksen: 'plum',
  },
]

export const allProjects: Project[] = [mainProject, ...otherProjects]

// ============================================================
// Progress reducer (mock) — sumber tunggal stage, CTA, blockers
// ============================================================

export function getProjectProgress(project: Project): ProjectProgress {
  return {
    stage: project.stage,
    tahapSelesai: ['fondasi', 'karakter'],
    nextAction: {
      label: 'Kunci fondasi cerita',
      alasan:
        'Kesiapan fondasi sudah 82%. Arah ending dan panggilan antartokoh masih perlu ditinjau sebelum rencana bab bisa dikunci.',
      href: `/app/p/${project.id}/fondasi`,
    },
    blockers: [
      'Arah ending belum ditinjau sejak konsep dipilih.',
      'Aturan panggilan antara Laras dan Ratri belum dikunci.',
      '1 usulan fakta berisiko tinggi menunggu keputusanmu.',
    ],
    counts: {
      babTerencana: project.babTerencana,
      babTertulis: project.babTertulis,
      faktaTerkunci: project.faktaTerkunci,
      usulanMenunggu: project.usulanMenunggu,
      rahasiaDitahan: 3,
    },
  }
}

// ============================================================
// Fondasi Cerita
// ============================================================

export const foundation: Foundation = {
  judulKerja: 'Rumah yang Menunggu Hujan',
  genre: 'Drama Keluarga · Romance Luka',
  targetPembaca:
    'Perempuan dan laki-laki 20–40 tahun pembaca serial mobile yang menyukai konflik rumah tangga realistis dan pemulihan diri.',
  premis:
    'Setelah dua tahun merantau demi biaya pengobatan ayahnya, Laras pulang ke rumah mertuanya dan menemukan suaminya telah menandatangani surat perjanjian pisah harta—tanpa pernah memberitahunya.',
  janjiPembaca:
    'Kamu akan mengikuti Laras memilih antara mempertahankan rumah tangga yang penuh rahasia atau membangun ulang hidupnya—dengan konflik yang terasa dekat dan ending yang membayar tuntas setiap pengorbanan.',
  tone: 'Hangat, menahan, sesekali pahit; emosi kuat disampaikan lewat detail kecil, bukan teriakan.',
  targetBab: 40,
  arahEnding:
    'Laras memilih jalannya sendiri: bukan kembali atau pergi karena dipaksa, melainkan setelah ia mengetahui seluruh kebenaran dan menagih haknya dengan kepala tegak.',
  tokohUtama: 'Laras Ayu Wicaksana (32), istri yang pulang setelah dua tahun merantau.',
  konflikUtama:
    'Laras ingin mempertahankan pernikahannya, tetapi setiap langkahnya di rumah itu dijaga oleh Ratri—dan Brama ternyata menyimpan perjanjian yang mengubah segalanya.',
  rahasiaUtama:
    'Brama menandatangani surat perjanjian pisah harta tanpa sepengetahuan Laras, atas desakan Ratri yang mengaku melindungi warisan keluarga.',
  aturanPanggilan: [
    { dari: 'Laras', kepada: 'Brama', panggilan: 'Mas', catatan: 'Tetap "Mas" bahkan saat marah; justru terasa menyakitkan.' },
    { dari: 'Brama', kepada: 'Laras', panggilan: 'Laras', catatan: 'Tidak pernah memakai panggilan sayang sejak kepulangan Laras.' },
    { dari: 'Ratri', kepada: 'Laras', panggilan: 'Nak Laras', catatan: 'Formal, sopan, tetapi tidak hangat.' },
    { dari: 'Laras', kepada: 'Ratri', panggilan: 'Ibu', catatan: 'Laras bertahan memanggil "Ibu" meski makin sulit.' },
    { dari: 'Naya', kepada: 'Laras', panggilan: 'Kak Laras', catatan: 'Satu-satunya yang memakai "Kak" dengan tulus.' },
  ],
  batasanKonten: [
    'Tanpa adegan kekerasan eksplisit.',
    'Konflik pelakor tidak dijadikan tontonan murahan.',
    'Tidak ada karakter yang jahat tanpa alasan yang bisa dipahami pembaca.',
  ],
  preferensiGaya: [
    'Paragraf pendek, nyaman dibaca di HP.',
    'Dialog dominan pada adegan konflik.',
    'Detail indra: hujan, aroma dapur, suara langkah di lantai kayu.',
  ],
  status: 'draft',
  kesiapan: 82,
  checklist: [
    { label: 'Premis dan janji pembaca', selesai: true },
    { label: 'Tokoh utama dan konflik utama', selesai: true },
    { label: 'Rahasia utama dan jadwal bukaannya', selesai: true },
    { label: 'Target panjang 40 bab', selesai: true },
    { label: 'Arah ending', selesai: false, catatan: 'Perlu ditinjau setelah konsep dipilih ulang.' },
    { label: 'Aturan panggilan antartokoh', selesai: false, catatan: 'Panggilan Laras–Ratri belum dikunci.' },
  ],
}

// ============================================================
// Karakter
// ============================================================

export const characters: Character[] = [
  {
    id: 'laras',
    nama: 'Laras Ayu Wicaksana',
    peran: 'Tokoh utama',
    tujuan: 'Mempertahankan pernikahan sambil tetap menjadi dirinya sendiri.',
    lukaBatin: 'Ditinggal ayahnya sakit saat ia merantau; merasa selalu terlambat untuk orang yang ia sayangi.',
    ketakutan: 'Bahwa semua pengorbanannya selama ini ternyata tidak dihargai siapa pun.',
    konflikInternal: 'Ingin marah, tetapi dibesarkan untuk "menjaga nama baik keluarga".',
    sifatDominan: ['Ulet', 'Pengamat', 'Menahan diri', 'Setia'],
    gayaBicara: 'Kalimat pendek, sopan, jarang meninggi; makin pelan justru saat emosi.',
    aturanPanggilan: 'Memanggil suami "Mas", mertua "Ibu", adik ipar "Naya".',
    relasi: [
      { targetId: 'brama', jenis: 'Suami', catatan: 'Cinta yang belum habis, tetapi kepercayaan retak.' },
      { targetId: 'ratri', jenis: 'Ibu mertua', catatan: 'Hubungan sopan di permukaan, perang dingin di dalam.' },
      { targetId: 'naya', jenis: 'Adik ipar', catatan: 'Satu-satunya sekutu di rumah itu.' },
    ],
    rahasiaDiketahui: ['Ayahnya menolak pengobatan agar Laras tidak terbebani utang.'],
    rahasiaDicurigai: ['Brama menyembunyikan sesuatu sejak kepulangannya.'],
    keyakinanSalah: 'Percaya surat perjanjian itu dibuat karena Brama sudah tidak mencintainya.',
    statusEmosional: 'Lelah, waspada, tetapi belum menyerah.',
    lokasiTerakhir: 'Kamar lama di rumah Ratri, Yogyakarta.',
    perubahanPerBab: [
      { bab: 1, ringkasan: 'Tiba di rumah mertua; menyadari sikap Brama berubah dingin.' },
      { bab: 2, ringkasan: 'Menemukan amplop cokelat di laci meja Brama, belum berani membuka.' },
    ],
  },
  {
    id: 'brama',
    nama: 'Brama Adiwangsa',
    peran: 'Suami Laras',
    tujuan: 'Menjaga rumah tangga dan bisnis keluarga tetap berjalan tanpa ledakan.',
    lukaBatin: 'Sejak kecil diajari bahwa laki-laki tidak boleh terlihat bingung.',
    ketakutan: 'Kehilangan Laras sekaligus mengecewakan ibunya—dua-duanya sekaligus.',
    konflikInternal: 'Tahu perjanjian itu salah, tetapi merasa sudah terlambat untuk mengaku.',
    sifatDominan: ['Pendiam', 'Bertanggung jawab', 'Menghindar dari konfrontasi'],
    gayaBicara: 'Formal, hemat kata; banyak jeda; sering mengalihkan ke urusan kerja.',
    aturanPanggilan: 'Memanggil Laras dengan nama, ibunya "Ibu", adiknya "Naya".',
    relasi: [
      { targetId: 'laras', jenis: 'Istri', catatan: 'Masih mencintai, tetapi memilih diam daripada jujur.' },
      { targetId: 'ratri', jenis: 'Ibu', catatan: 'Patuh hampir tanpa syarat.' },
      { targetId: 'naya', jenis: 'Adik', catatan: 'Protektif, satu-satunya tempat ia bisa santai.' },
    ],
    rahasiaDiketahui: ['Perjanjian pisah harta yang ia tandatangani atas desakan Ratri.'],
    rahasiaDicurigai: ['Ratri pernah terlibat dalam kepergian ibu kandung Laras bertahun-tahun lalu.'],
    keyakinanSalah: 'Mengira Laras akan lebih tenang bila tidak tahu apa-apa.',
    statusEmosional: 'Tertekan, gelisah, mencari waktu yang tepat untuk mengaku.',
    lokasiTerakhir: 'Ruang kerja di rumah Ratri.',
    perubahanPerBab: [
      { bab: 1, ringkasan: 'Menyambut Laras dengan canggung; menyembunyikan amplop perjanjian.' },
      { bab: 2, ringkasan: 'Mulai curiga Laras menemukan sesuatu; makin sering salah tingkah.' },
    ],
  },
  {
    id: 'ratri',
    nama: 'Ratri Adiwangsa',
    peran: 'Ibu mertua',
    tujuan: 'Memastikan nama dan harta keluarga Adiwangsa tidak jatuh ke tangan yang salah.',
    lukaBatin: 'Pernah kehilangan hampir segalanya saat suaminya bangkrut; sejak itu memegang kendali dengan erat.',
    ketakutan: 'Rumah dan warisan keluarga lepas ke orang luar—dan baginya Laras masih orang luar.',
    konflikInternal: 'Ingin menjadi ibu yang baik, tetapi definisi "baik"-nya adalah mengendalikan.',
    sifatDominan: ['Tegas', 'Teratur', 'Menyimpan dendam dengan rapi'],
    gayaBicara: 'Sopan berlapis; kritik disampaikan lewat nasihat.',
    aturanPanggilan: 'Memanggil Laras "Nak Laras", Brama "Brama", Naya "Naya".',
    relasi: [
      { targetId: 'laras', jenis: 'Menantu', catatan: 'Belum pernah benar-benar menerima Laras.' },
      { targetId: 'brama', jenis: 'Anak', catatan: 'Bangga, tetapi posesif.' },
      { targetId: 'naya', jenis: 'Anak', catatan: 'Paling lunak pada Naya.' },
    ],
    rahasiaDiketahui: [
      'Perjanjian pisah harta—ia yang mengusulkan.',
      'Riwayat kepergian ibu kandung Laras dari rumah itu (belum terkonfirmasi).',
    ],
    rahasiaDicurigai: [],
    keyakinanSalah: 'Percaya Laras menikahi Brama demi keamanan ekonomi.',
    statusEmosional: 'Waspada, merasa wilayahnya dimasuki kembali.',
    lokasiTerakhir: 'Ruang tengah rumah.',
    perubahanPerBab: [
      { bab: 1, ringkasan: 'Menyambut Laras dengan aturan rumah yang diperjelas.' },
      { bab: 2, ringkasan: 'Mengawasi interaksi Laras dan Brama lebih ketat.' },
    ],
  },
  {
    id: 'naya',
    nama: 'Naya Adiwangsa',
    peran: 'Adik ipar Laras',
    tujuan: 'Melihat kakaknya berani jujur dan keluarganya berhenti berpura-pura.',
    lukaBatin: 'Selalu dianggap paling kecil sehingga tidak pernah diajak bicara serius.',
    ketakutan: 'Rumahnya hancur justru karena semua orang saling menyimpan.',
    konflikInternal: 'Ingin membela Laras, tetapi tidak ingin mengkhianati ibu dan kakaknya.',
    sifatDominan: ['Jujur', 'Hangat', 'Tidak sabaran'],
    gayaBicara: 'Santai, ceplas-ceplos, sesekali menyindir dengan bercanda.',
    aturanPanggilan: 'Memanggil Laras "Kak Laras", Brama "Mas Brama", Ratri "Ibu".',
    relasi: [
      { targetId: 'laras', jenis: 'Kakak ipar', catatan: 'Mengagumi Laras sejak dulu.' },
      { targetId: 'brama', jenis: 'Kakak', catatan: 'Kesal pada sikap diam Brama.' },
      { targetId: 'ratri', jenis: 'Ibu', catatan: 'Sayang, tetapi sadar ibunya suka mengatur.' },
    ],
    rahasiaDiketahui: [],
    rahasiaDicurigai: ['Ada dokumen penting yang disembunyikan Brama dan Ratri.'],
    keyakinanSalah: 'Mengira Laras dan Brama hanya sedang bertengkar biasa.',
    statusEmosional: 'Ceria di luar, cemas di dalam.',
    lokasiTerakhir: 'Dapur rumah.',
    perubahanPerBab: [
      { bab: 1, ringkasan: 'Satu-satunya yang menyambut Laras dengan antusias.' },
      { bab: 2, ringkasan: 'Mulai merasa ada yang disembunyikan darinya.' },
    ],
  },
]

// ============================================================
// Fakta (semua 5 status)
// ============================================================

export const facts: Fact[] = [
  {
    id: 'f1',
    isi: 'Laras merantau dua tahun ke Kalimantan untuk membiayai pengobatan ayahnya.',
    kategori: 'Latar tokoh',
    status: 'confirmed',
    sumber: 'kamu',
    babTerkait: 1,
  },
  {
    id: 'f2',
    isi: 'Brama menandatangani surat perjanjian pisah harta tanpa sepengetahuan Laras.',
    kategori: 'Rahasia utama',
    status: 'confirmed',
    sumber: 'kamu',
    catatan: 'Terkunci sebagai rahasia utama cerita. Jadwal terbuka penuh: Bab 25.',
  },
  {
    id: 'f3',
    isi: 'Ratri mengusulkan perjanjian pisah harta dengan alasan melindungi warisan keluarga.',
    kategori: 'Motivasi tokoh',
    status: 'confirmed',
    sumber: 'narra',
    babTerkait: 3,
  },
  {
    id: 'f4',
    isi: 'Rumah keluarga Adiwangsa di Yogyakarta adalah warisan dari ayah Brama.',
    kategori: 'Dunia cerita',
    status: 'confirmed',
    sumber: 'sistem',
  },
  {
    id: 'f5',
    isi: 'Naya sedang menyiapkan beasiswa ke luar kota dan belum memberi tahu ibunya.',
    kategori: 'Subplot',
    status: 'proposed',
    sumber: 'narra',
    risiko: 'rendah',
    dampak: 'Memberi Naya alur sendiri dan alasan untuk lebih dekat dengan Laras.',
  },
  {
    id: 'f6',
    isi: 'Ratri pernah mengusir ibu kandung Laras dari rumah itu dua puluh tujuh tahun lalu.',
    kategori: 'Keluarga / rahasia besar',
    status: 'proposed',
    sumber: 'narra',
    risiko: 'tinggi',
    dampak:
      'Fakta ini mengubah motivasi Ratri, riwayat keluarga Laras, dan arah konflik utama. Menjadikannya fakta terkunci akan mengikat banyak bab berikutnya.',
  },
  {
    id: 'f7',
    isi: 'Brama memiliki hubungan baru selama Laras merantau.',
    kategori: 'Relasi',
    status: 'rejected',
    sumber: 'narra',
    catatan: 'Ditolak: tidak sesuai janji pembaca; konflik dijaga tanpa jalur perselingkuhan.',
  },
  {
    id: 'f8',
    isi: 'Ayah Laras bekerja sebagai guru sekolah dasar sebelum sakit.',
    kategori: 'Latar tokoh',
    status: 'deprecated',
    sumber: 'kamu',
    catatan: 'Digantikan oleh fakta terbaru: ayah Laras adalah pensiunan pegawai kelurahan.',
  },
  {
    id: 'f9',
    isi: 'Laras mengetahui perjanjian pisah harta sejak sebelum pulang.',
    kategori: 'Pengetahuan tokoh',
    status: 'contradicted',
    sumber: 'narra',
    catatan: 'Bertentangan dengan rahasia utama: Laras belum tahu apa pun sampai menemukan amplop itu.',
  },
  {
    id: 'f10',
    isi: 'Bisnis keluarga Adiwangsa bergerak di bidang mebel kayu jati dan sedang turun dua tahun terakhir.',
    kategori: 'Dunia cerita',
    status: 'confirmed',
    sumber: 'narra',
    babTerkait: 4,
  },
  {
    id: 'f11',
    isi: 'Laras pernah bekerja sebagai admin di butik sebelum menikah.',
    kategori: 'Latar tokoh',
    status: 'proposed',
    sumber: 'narra',
    risiko: 'rendah',
    dampak: 'Memberi Laras keterampilan yang bisa dipakai pada alur pemulihan ekonominya.',
  },
  {
    id: 'f12',
    isi: 'Ayah Laras meninggal enam bulan sebelum Laras pulang.',
    kategori: 'Latar tokoh',
    status: 'confirmed',
    sumber: 'kamu',
    babTerkait: 1,
  },
]

// ============================================================
// Rencana Bab — 10 bab dengan arahan lengkap
// ============================================================

export const outline: ChapterOutline[] = [
  {
    id: 'bab-1',
    nomor: 1,
    judul: 'Pintu yang Sama, Rumah yang Berbeda',
    ringkasan:
      'Laras tiba di rumah mertua setelah dua tahun. Sambutan sopan dari Ratri, antusias dari Naya, dan kecanggungan Brama menandai bahwa rumah ini sudah tidak sama.',
    fungsiBab: 'Pembuka: menancapkan janji pembaca dan rasa "ada yang tidak beres".',
    arahEmosi: 'Lelah → lega semu → waspada.',
    janjiBab: 'Pembaca merasakan rumah yang asing bagi penghuninya sendiri.',
    openingHook: 'Laras berdiri di depan pintu yang dulu ia keluar dengan air mata, kali ini dengan dua koper dan satu kabar duka.',
    openLoop: ['Mengapa Brama tidak menjemput di stasiun?', 'Amplop cokelat yang buru-buru disembunyikan Ratri.'],
    kemenanganKecil: 'Laras menolak dibantu membawa koper—tanda ia tidak datang untuk bergantung.',
    breadcrumb: 'Ratri menyebut "urusan kantor sudah beres" tanpa menjelaskan.',
    rahasiaDitahan: ['Perjanjian pisah harta'],
    forbiddenReveal: ['Isi amplop cokelat', 'Peran Ratri dalam perjanjian'],
    endingHook: 'Di kamar lamanya, Laras menemukan foto pernikahannya sudah dipindahkan ke laci.',
    status: 'diterima',
  },
  {
    id: 'bab-2',
    nomor: 2,
    judul: 'Aturan Rumah yang Diperjelas',
    ringkasan:
      'Ratri menetapkan aturan baru rumah dengan sopan dan tegas. Laras menemukan amplop cokelat di laci meja Brama, tetapi belum berani membukanya.',
    fungsiBab: 'Menegaskan perang dingin Laras–Ratri dan menaikkan rasa penasaran.',
    arahEmosi: 'Tertekan → curiga → menahan.',
    janjiBab: 'Konflik terasa tanpa satu pun teriakan.',
    openingHook: 'Daftar aturan rumah tercetak rapi di atas meja makan, tepat di sebelah sarapan Laras.',
    openLoop: ['Apa isi amplop cokelat di laci Brama?'],
    kemenanganKecil: 'Laras menjawab satu aturan Ratri dengan tenang dan memenangkan simpati Naya.',
    breadcrumb: 'Brama bereaksi berlebihan saat Laras mendekati meja kerjanya.',
    rahasiaDitahan: ['Perjanjian pisah harta'],
    forbiddenReveal: ['Isi amplop cokelat'],
    endingHook: 'Malam itu Laras membuka laci—amplopnya sudah tidak ada.',
    status: 'diterima',
  },
  {
    id: 'bab-3',
    nomor: 3,
    judul: 'Makan Malam Paling Sopan',
    ringkasan:
      'Makan malam keluarga yang sangat sopan berubah menjadi duel halus antara Laras dan Ratri. Naya mencairkan suasana, Brama memilih diam.',
    fungsiBab: 'Memperdalam karakter dan memperlihatkan dinamika meja makan sebagai medan perang.',
    arahEmosi: 'Canggung → tegang → pilu.',
    janjiBab: 'Dialog tajam yang bisa dibaca ulang.',
    openingHook: 'Ratri memasak hidangan kesukaan Brama—dan satu pun bukan kesukaan Laras.',
    openLoop: ['Mengapa Ratri menyebut nama ibu Laras dengan nada aneh?'],
    kemenanganKecil: 'Laras membuat teh untuk semua orang dan Ratri terpaksa meminumnya.',
    breadcrumb: 'Naya menyebut "waktu itu Ibu juga yang mengatur" lalu berhenti sendiri.',
    rahasiaDitahan: ['Perjanjian pisah harta', 'Riwayat ibu kandung Laras (usulan)'],
    forbiddenReveal: ['Isi perjanjian', 'Kejadian 27 tahun lalu'],
    endingHook: 'Laras menemukan namanya tidak tertulis di daftar penghuni rumah di papan pengumuman keluarga.',
    status: 'perlu-ditinjau',
  },
  {
    id: 'bab-4',
    nomor: 4,
    judul: 'Kayu Jati yang Mulai Lapuk',
    ringkasan:
      'Laras mengantar makan siang ke workshop mebel keluarga dan melihat sendiri bisnis itu sedang turun. Brama mulai terbuka sedikit tentang tekanannya.',
    fungsiBab: 'Memperluas dunia cerita dan memberi Brama sisi yang bisa dikasihi pembaca.',
    arahEmosi: 'Penasaran → iba → harapan kecil.',
    janjiBab: 'Pembaca paham beban Brama tanpa memaafkannya.',
    openingHook: 'Bau kayu jati dan lem—aroma yang dulu membuat Laras jatuh cinta pada rumah ini.',
    openLoop: ['Untuk apa bisnis yang merugi membutuhkan perjanjian harta?'],
    kemenanganKecil: 'Brama tertawa untuk pertama kalinya sejak Laras pulang.',
    breadcrumb: 'Seorang pegawai lama menyapa Laras dengan nama ibunya.',
    rahasiaDitahan: ['Perjanjian pisah harta'],
    forbiddenReveal: ['Kondisi sebenarnya keuangan keluarga'],
    endingHook: 'Di workshop, Laras menemukan kopian surat dengan tanda tangan Brama—sobek.',
    status: 'terencana',
  },
  {
    id: 'bab-5',
    nomor: 5,
    judul: 'Amplop yang Akhirnya Terbuka',
    ringkasan:
      'Laras akhirnya membaca perjanjian pisah harta. Ia tidak menangis; ia mulai menghitung.',
    fungsiBab: 'Mid-arc twist: rahasia utama terbuka untuk tokoh utama, bukan untuk pembaca penuh.',
    arahEmosi: 'Tegang → dingin → tekad.',
    janjiBab: 'Momen yang membuat pembaca menahan napas dan lanjut ke bab berikutnya.',
    openingHook: 'Kertas itu lebih tipis dari yang Laras bayangkan, tetapi lebih berat dari apa pun yang pernah ia bawa.',
    openLoop: ['Apa yang akan Laras lakukan dengan informasi ini?', 'Siapa notaris yang menyiapkan surat itu?'],
    kemenanganKecil: 'Laras tidak meledak; ia memotret surat itu dan mengembalikannya rapi.',
    breadcrumb: 'Tanggal surat itu jatuh seminggu setelah ayah Laras meninggal.',
    rahasiaDitahan: ['Peran Ratri dalam perjanjian'],
    forbiddenReveal: ['Motivasi sebenarnya Ratri'],
    endingHook: 'Ponsel Laras bergetar: pesan dari nomor tidak dikenal, "Kamu seharusnya tidak membaca itu."',
    status: 'terencana',
  },
  {
    id: 'bab-6',
    nomor: 6,
    judul: 'Nomor Tidak Dikenal',
    ringkasan:
      'Laras menyelidiki pesan misterius sambil menjaga sikap di rumah. Naya mulai curiga ada yang disembunyikan darinya.',
    fungsiBab: 'Membangun misteri dan mengaktifkan subplot Naya.',
    arahEmosi: 'Waspada → lelah → dekat (Laras–Naya).',
    janjiBab: 'Laras berhenti menjadi korban pasif.',
    openingHook: 'Ada orang yang tahu Laras membaca surat itu—padahal ia tidak memberi tahu siapa pun.',
    openLoop: ['Siapa pengirim pesan?', 'Apa yang Naya dengar dari kamar Ratri?'],
    kemenanganKecil: 'Laras membuka rekening atas namanya sendiri untuk pertama kali.',
    breadcrumb: 'Notaris surat itu ternyata kenalan lama keluarga Ratri.',
    rahasiaDitahan: ['Identitas pengirim pesan', 'Peran Ratri'],
    forbiddenReveal: ['Motivasi Ratri', 'Riwayat ibu Laras'],
    endingHook: 'Naya bertanya langsung: "Kak Laras, kalian sebenarnya kenapa?"',
    status: 'terencana',
  },
  {
    id: 'bab-7',
    nomor: 7,
    judul: 'Hujan Pertama di Musim Kemarau',
    ringkasan:
      'Hujan aneh turun di puncak kemarau. Laras dan Brama terjebak berdua di workshop dan akhirnya bicara—setengah jujur.',
    fungsiBab: 'Bab napas + romansa luka; mengingatkan pembaca mengapa pasangan ini layak diperjuangkan.',
    arahEmosi: 'Canggung → hangat → retak lagi.',
    janjiBab: 'Adegan berdua yang manis sekaligus menyakitkan.',
    openingHook: 'Hujan turun seperti salah alamat—dan Laras tidak bisa pulang.',
    openLoop: ['Apa yang hampir Brama akui sebelum ponsel Ratri berbunyi?'],
    kemenanganKecil: 'Brama mengulang panggilan lamanya: "Laras." Kali ini tanpa jarak.',
    breadcrumb: 'Brama menyebut "surat itu seharusnya tidak pernah ada".',
    rahasiaDitahan: ['Peran Ratri', 'Pengirim pesan'],
    forbiddenReveal: ['Motivasi Ratri'],
    endingHook: 'Di bawah pintu kamar Laras, ada foto lama: Ratri muda berdiri di depan rumah ini—bersama ibu Laras.',
    status: 'terencana',
  },
  {
    id: 'bab-8',
    nomor: 8,
    judul: 'Foto dari Dua Puluh Tujuh Tahun Lalu',
    ringkasan:
      'Laras menggali riwayat ibunya dan menemukan bahwa ibunya pernah tinggal di rumah ini. Ratri menyadari Laras mulai menggali.',
    fungsiBab: 'Menghubungkan rahasia besar keluarga dengan konflik sekarang.',
    arahEmosi: 'Terkejut → marah tertahan → fokus.',
    janjiBab: 'Lapisan misteri keluarga terbuka satu tingkat.',
    openingHook: 'Di foto itu, ibu Laras tersenyum di teras yang sama tempat Laras sekarang minum teh setiap pagi.',
    openLoop: ['Mengapa ibu Laras pergi dari rumah itu?', 'Siapa yang menyelipkan foto di bawah pintu?'],
    kemenanganKecil: 'Laras mendapat nama saksi lama: pegawai workshop yang menyapanya di Bab 4.',
    breadcrumb: 'Ratri mulai ramah secara berlebihan—tanda ia gelisah.',
    rahasiaDitahan: ['Detail kepergian ibu Laras (usulan)', 'Pengirim pesan'],
    forbiddenReveal: ['Keseluruhan kejadian 27 tahun lalu'],
    endingHook: 'Ratri mengetuk kamar Laras tengah malam: "Kita perlu bicara, Nak."',
    status: 'terencana',
  },
  {
    id: 'bab-9',
    nomor: 9,
    judul: 'Bicara dengan Ibu',
    ringkasan:
      'Percakapan Laras–Ratri yang sesungguhnya: dua perempuan yang sama-sama keras kepala. Tidak ada yang menang, tetapi semua kartu mulai terlihat.',
    fungsiBab: 'Duel dialog utama; pembaca melihat Ratri sebagai manusia, bukan villain.',
    arahEmosi: 'Tegang → terbuka sedikit → dingin kembali.',
    janjiBab: 'Dialog dua tokoh kuat yang setara.',
    openingHook: 'Ratri menuang teh untuk Laras—untuk pertama kalinya.',
    openLoop: ['Apa yang Ratri minta Laras janjikan?'],
    kemenanganKecil: 'Laras mengakui satu kesalahannya tanpa merendahkan dirinya.',
    breadcrumb: 'Ratri menyebut "kamu lebih mirip ibumu daripada yang kamu kira".',
    rahasiaDitahan: ['Kejadian 27 tahun lalu secara utuh'],
    forbiddenReveal: ['Keputusan akhir Ratri soal perjanjian'],
    endingHook: 'Brama berdiri di depan pintu, mendengar semuanya.',
    status: 'terencana',
  },
  {
    id: 'bab-10',
    nomor: 10,
    judul: 'Yang Didengar dari Balik Pintu',
    ringkasan:
      'Brama akhirnya tahu Laras sudah membaca perjanjian itu. Konfrontasi pasangan yang ditunggu sejak Bab 1 pecah—dan mini arc pertama ditutup.',
    fungsiBab: 'Klimaks mini arc 1: konfrontasi terbuka Laras–Brama.',
    arahEmosi: 'Meledak → jujur → belum selesai.',
    janjiBab: 'Konfrontasi yang membayar penumpukan 9 bab.',
    openingHook: 'Brama tidak mengetuk. Ia langsung masuk, dan untuk pertama kalinya, Laras tidak menyembunyikan apa pun.',
    openLoop: ['Apakah Brama akan memilih Laras atau ibunya?', 'Apa rencana Laras setelah ini?'],
    kemenanganKecil: 'Brama akhirnya berkata jujur: "Aku yang salah sejak awal."',
    breadcrumb: 'Pengirim pesan misterius terungkap setengah: seseorang dari dalam rumah.',
    rahasiaDitahan: ['Motivasi penuh Ratri (menuju Bab 25)'],
    forbiddenReveal: ['Resolusi perjanjian'],
    endingHook: 'Ratri memanggil notaris dan berkata, "Kita mulai rencana yang kedua."',
    status: 'terencana',
  },
]

// ============================================================
// Jadwal Rahasia
// ============================================================

export const revealSchedule: RevealEntry[] = [
  {
    id: 'r1',
    rahasia: 'Brama menandatangani surat perjanjian pisah harta tanpa sepengetahuan Laras.',
    pemegang: ['Brama', 'Ratri'],
    rencanaBabTerbuka: 25,
    status: 'ditahan',
    catatan: 'Laras menemukan suratnya di Bab 5, tetapi alasan dan peran penuh Ratri baru terbuka di Bab 25.',
  },
  {
    id: 'r2',
    rahasia: 'Ratri pernah mengusir ibu kandung Laras dari rumah itu (usulan, berisiko tinggi).',
    pemegang: ['Ratri'],
    rencanaBabTerbuka: 27,
    status: 'ditahan',
    catatan: 'Masih berstatus usulan. Baru dijadwalkan bila kamu mengunci faktanya.',
  },
  {
    id: 'r3',
    rahasia: 'Identitas pengirim pesan misterius kepada Laras.',
    pemegang: ['?'],
    rencanaBabTerbuka: 10,
    status: 'terjadwal',
    catatan: 'Terbuka setengah di Bab 10 (seseorang dari dalam rumah), penuh di Bab 14.',
  },
  {
    id: 'r4',
    rahasia: 'Ayah Laras menolak pengobatan agar Laras tidak terbebani utang.',
    pemegang: ['Laras'],
    rencanaBabTerbuka: 1,
    status: 'terbuka',
    catatan: 'Sudah diketahui Laras sejak awal; dipakai untuk membangun luka batinnya.',
  },
]

// ============================================================
// Konsep alternatif
// ============================================================

export const concepts: Concept[] = [
  {
    id: 'konsep-1',
    judul: 'Rumah yang Menunggu Hujan',
    premis:
      'Istri yang pulang dari merantau menemukan perjanjian pisah harta yang tidak pernah ia tandatangani.',
    hook: 'Konflik rumah tangga dengan rahasia dokumen—dekat, nyata, dan mudah diikuti pembaca serial.',
    perbedaanUtama: 'Fokus pada perang dingin menantu–mertua dan pemulihan diri Laras.',
    status: 'dipilih',
  },
  {
    id: 'konsep-2',
    judul: 'Surat yang Tidak Pernah Dibaca',
    premis:
      'Laras menemukan surat-surat ayahnya yang tidak pernah dikirim, dan satu di antaranya menyebut nama Ratri.',
    hook: 'Misteri keluarga dua generasi dengan tempo lebih lambat dan emosi lebih dalam.',
    perbedaanUtama: 'Fokus pada riwayat ibu Laras; konflik sekarang menjadi lapisan kedua.',
    status: 'alternatif',
  },
  {
    id: 'konsep-3',
    judul: 'Pengganti yang Datang Terlambat',
    premis:
      'Saat Laras merantau, Ratri menyiapkan perjodohan baru untuk Brama—dan calon itu muncul tepat saat Laras pulang.',
    hook: 'Konflik segitiga yang kuat untuk retensi bab awal.',
    perbedaanUtama: 'Lebih dramatis dan cepat, tetapi berisiko terasa generik dan melanggar batasan konten.',
    status: 'alternatif',
  },
]

// ============================================================
// Percakapan Narra (seed)
// ============================================================

export const chatSeed: ChatMessage[] = [
  {
    id: 'c1',
    dari: 'kamu',
    teks: 'Aku punya ide tentang istri yang pulang ke rumah mertua setelah lama merantau, tapi suaminya berubah dingin.',
    waktu: '09.12',
  },
  {
    id: 'c2',
    dari: 'narra',
    teks: 'Ide yang kuat—rasa "pulang tapi tidak dianggap pulang" itu relatable. Biar konfliknya bisa panjang, kita butuh satu rahasia yang dipegang suaminya. Aku bantu susun tiga pilihan arah cerita. Mau kualiahati?',
    waktu: '09.13',
    quickReplies: ['Lihat tiga arah cerita', 'Aku mau cerita lebih dulu', 'Ubah premisnya'],
  },
  {
    id: 'c3',
    dari: 'kamu',
    teks: 'Lihat tiga arah cerita.',
    waktu: '09.14',
  },
  {
    id: 'c4',
    dari: 'narra',
    teks: 'Ini tiga arah yang mungkin cocok. Yang pertama paling dekat dengan idemu: dokumen rahasia di dalam rumah tangga. Yang kedua lebih ke misteri keluarga dua generasi. Yang ketiga paling dramatis, tapi menurutku berisiko terasa generik. Kamu yang memutuskan—aku hanya mengusulkan.',
    waktu: '09.14',
    quickReplies: ['Pilih arah pertama', 'Pilih arah kedua', 'Diskusikan dulu'],
  },
  {
    id: 'c5',
    dari: 'kamu',
    teks: 'Pilih arah pertama. Rahasianya: suami tanda tangan perjanjian pisah harta tanpa sepengetahuan istri.',
    waktu: '09.16',
  },
  {
    id: 'c6',
    dari: 'narra',
    teks: 'Bagus. Rahasia itu cukup besar untuk menopang 40 bab, asal kita jadwalkan bukaannya dengan hati-hati. Aku sudah menyiapkan draf Fondasi Cerita dari pilihanmu. Sekarang tinggal kita rapikan arah ending dan aturan panggilan antartokoh sebelum fondasi dikunci.',
    waktu: '09.17',
    quickReplies: ['Tinjau fondasi', 'Atur panggilan tokoh', 'Lanjut nanti'],
  },
]

// ============================================================
// Contoh prosa — Bab 1, Adegan 1 (~600 kata) + 3 versi kandidat
// ============================================================

const proseBab1Adegan1 = `Hujan belum turun ketika Laras berdiri di depan pintu rumah itu. Padahal langit Yogyakarta sore itu sudah seperti orang menahan tangis—menggantung, berat, tidak kunjung pecah.

Dua tahun. Dua koper. Satu kabar duka yang masih tersimpan rapi di saku jaketnya, dalam bentuk foto ayahnya yang terakhir.

Ia mengetuk pintu yang dulu tidak pernah perlu ia ketuk.

Yang membuka adalah Naya. Adik iparnya itu membelalak sekejap, lalu menariknya masuk tanpa banyak tanya. "Kak Laras! Mas Brama nggak bilang Kakak pulang hari ini—"

"Dia memang belum tahu," kata Laras pelan. Ia menaruh kopernya sendiri di sudut ruang tamu ketika Naya hendak membantunya. Kebiasaan lama: jangan merepotkan siapa pun.

Dari arah dapur, Ratri muncul sambil mengeringkan tangan. Tidak ada pelukan. Tidak ada pertanyaan tentang perjalanan. Yang ada hanya anggukan sopan dan kalimat yang sudah disiapkan sejak lama.

"Nak Laras. Kamarnya masih seperti dulu. Handuk bersih ada di lemari." Jeda sebentar. "Ayahmu sudah tenang sekarang. Kamu tidak perlu menyalahkan diri terus."

Kalimat yang benar. Nada yang salah. Laras tahu betul perbedaannya.

"Iya, Bu. Terima kasih."

Brama pulang ketika magrib. Laras mendengar suara motornya lebih dulu—masih motor yang sama, masih cara memarkir yang sama. Dua tahun ternyata tidak cukup lama untuk menghapus hal-hal sekecil itu.

Tapi cukup lama untuk menghapus yang lain.

"Laras." Brama berdiri di ambang pintu ruang tamu, masih memakai kemeja kerjanya, masih dengan cara menatapnya yang dulu. Hanya saja kali ini tatapan itu tidak sampai. "Kapan sampainya?"

"Sore tadi." Laras menunggu. Menunggu pelukan, atau setidaknya langkah mendekat. Yang datang hanya anggukan.

"Bagus. Ibu pasti senang."

Bukan aku senang. Ibu senang.

Saat makan malam, Ratri menjelaskan aturan rumah dengan suara selembut kain. Jam berapa dapur boleh dipakai. Bagian lemari es yang mana. Laras menyimak sambil menghitung berapa kali Brama menunduk ke piringnya. Tujuh. Tujuh kali dalam satu makan malam, dan tidak sekali pun ke arahnya.

Malam itu, di kamar lama mereka, Laras membuka lemari untuk menyimpan pakaiannya. Di rak paling atas, tempat foto pernikahan mereka dulu berdiri, kini kosong. Ia menemukan foto itu di laci kedua, terbalik, ditindih kain batik.

Ia mengangkatnya. Mengusap kacanya dengan ibu jari. Lalu mengembalikannya persis seperti semula—terbalik.

Bukan karena ia menyerah.

Karena ia ingin tahu siapa yang memindahkannya, dan kenapa.

Di luar, hujan akhirnya turun. Rumah tua itu berderit pelan, seperti orang yang sudah lama menahan cerita. Laras berbaring membelakangi suaminya, mendengarkan air mengetuk genteng, dan berjanji pada dirinya sendiri: kali ini ia tidak akan pergi sebelum semua yang disembunyikan rumah ini selesai mengakuinya.`

export const proseSample: ProseVersion = {
  id: 'pv-1',
  label: 'versi-diterima',
  judul: 'Bab 1 · Adegan 1 — Pulang',
  cuplikan: 'Laras tiba di rumah mertua dan merasakan rumah yang sama menjadi asing.',
  isi: proseBab1Adegan1,
}

export const proseCandidates: ProseVersion[] = [
  {
    id: 'pv-1',
    label: 'versi-diterima',
    judul: 'Versi 1 — Diterima',
    cuplikan: 'Fokus pada detail kecil: foto terbalik, tujuh kali Brama menunduk.',
    isi: proseBab1Adegan1,
  },
  {
    id: 'pv-2',
    label: 'dibuat-narra',
    judul: 'Versi 2 — Alternatif',
    cuplikan: 'Dibuka dari sudut pandang Naya; tempo lebih cepat, dialog lebih dominan.',
    isi: 'Naya sedang mengupas mangga di dapur ketika ketukan itu terdengar. Dua tahun tidak ada yang mengetuk pintu depan—semua orang masuk lewat samping. Ia membukanya, dan di sana berdiri Kak Laras dengan dua koper dan mata yang lebih tua dari yang Naya ingat...',
  },
  {
    id: 'pv-3',
    label: 'dibuat-narra',
    judul: 'Versi 3 — Alternatif',
    cuplikan: 'Dibuka dari kilas balik keberangkatan Laras dua tahun lalu; lebih emosional di awal.',
    isi: 'Dua tahun lalu Laras keluar lewat pintu yang sama dengan satu koper dan satu janji: segera pulang kalau pengobatan Ayah selesai. Janji itu terbayar dengan cara yang tidak pernah ia bayangkan—sebuah foto di saku jaket dan rumah duka yang sudah dibongkar...',
  },
]

// ============================================================
// Cek Cerita — contoh temuan
// ============================================================

export const validatorFindings: ValidatorFinding[] = [
  {
    id: 'v1',
    level: 'lolos',
    judul: 'Cerita nyambung',
    detail: 'Kejadian adegan ini sesuai dengan fakta terkunci dan kejadian bab sebelumnya.',
  },
  {
    id: 'v2',
    level: 'lolos',
    judul: 'Rahasia tetap aman',
    detail: 'Adegan tidak membocorkan isi perjanjian yang dijadwalkan terbuka di Bab 25.',
  },
  {
    id: 'v3',
    level: 'peringatan',
    judul: 'Pengetahuan tokoh perlu dicek',
    detail:
      'Naya menyebut "urusan kantor" dengan nada tahu, padahal ia belum pernah diberi tahu soal dokumen apa pun. Sebaiknya kalimatnya dibuat lebih umum.',
    area: 'Bab 1 · dialog Naya',
  },
  {
    id: 'v4',
    level: 'penghambat',
    judul: 'Tokoh bereaksi seolah sudah tahu rahasia',
    detail:
      'Laras menatap laci meja Brama "seperti sudah tahu isinya". Laras belum mengetahui apa pun tentang perjanjian pada titik cerita ini. Adegan perlu diperbaiki sebelum bisa diterima.',
    area: 'Bab 1 · paragraf 12',
  },
]

// ============================================================
// Perubahan Setelah Bab (chapter delta) — contoh Bab 1
// ============================================================

export const chapterDelta: ChapterDelta = {
  bab: 1,
  faktaBaru: [
    'Foto pernikahan Laras dan Brama sudah dipindahkan ke laci oleh seseorang di rumah itu.',
    'Ratri menetapkan aturan rumah baru setelah kepulangan Laras.',
  ],
  perubahanTokoh: [
    'Laras: lelah → waspada. Mulai menyadari ada yang disembunyikan.',
    'Brama: menghindar; tidak sekali pun menatap Laras saat makan malam.',
  ],
  rahasiaBerubah: [],
  openLoopBaru: ['Mengapa Brama tidak menjemput di stasiun?', 'Siapa yang memindahkan foto pernikahan?'],
  openLoopTertutup: [],
}

// ============================================================
// Paket Publish — contoh Bab 1
// ============================================================

export const publishPackage: PublishPackage = {
  judul: 'Rumah yang Menunggu Hujan — Bab 1: Pintu yang Sama, Rumah yang Berbeda',
  teaser:
    'Dua tahun merantau demi pengobatan ayahnya, Laras pulang membawa dua koper dan satu kabar duka. Tapi rumah yang ia tinggalkan ternyata menyimpan lebih banyak rahasia daripada yang ia bawa pergi.',
  caption:
    'Bab 1 sudah tayang. Laras kembali ke rumah mertuanya setelah dua tahun—dan menemukan foto pernikahannya sudah dipindahkan ke laci. Menurutmu siapa yang memindahkannya? Baca selengkapnya dan ikuti perjalanan Laras.',
  commentBait: 'Kalau kamu jadi Laras, kamu akan langsung bertanya atau diam dulu sambil mengamati?',
  tags: ['drama keluarga', 'romance luka', 'serial indonesia', 'rumah tangga', 'cerita berseri'],
  sinopsis:
    'Setelah dua tahun merantau demi biaya pengobatan ayahnya, Laras pulang ke rumah mertuanya—dan menemukan pernikahannya menyimpan perjanjian yang tidak pernah ia tandatangani.',
}

// ============================================================
// Kredit
// ============================================================

export const creditSummary: CreditSummary = {
  tersedia: 12450,
  tertahan: 320,
  rekonsiliasi: 0,
}

export const creditLedger: CreditEntry[] = [
  { id: 'k1', tanggal: '18 Jul 2026', jenis: 'grant', jumlah: 15000, saldoSetelah: 15000, keterangan: 'Kredit awal akun baru' },
  { id: 'k2', tanggal: '18 Jul 2026', jenis: 'reserve', jumlah: -180, saldoSetelah: 14820, keterangan: 'Penyusunan 3 konsep cerita' },
  { id: 'k3', tanggal: '18 Jul 2026', jenis: 'settle', jumlah: 0, saldoSetelah: 14820, keterangan: 'Konsep selesai — sesuai perkiraan' },
  { id: 'k4', tanggal: '19 Jul 2026', jenis: 'reserve', jumlah: -240, saldoSetelah: 14580, keterangan: 'Penyusunan rencana 10 bab' },
  { id: 'k5', tanggal: '19 Jul 2026', jenis: 'release', jumlah: 40, saldoSetelah: 14620, keterangan: 'Sebagian dana dikembalikan — proses lebih ringan dari perkiraan' },
  { id: 'k6', tanggal: '20 Jul 2026', jenis: 'reserve', jumlah: -320, saldoSetelah: 14300, keterangan: 'Penulisan Bab 1 Adegan 1 (3 versi)' },
  { id: 'k7', tanggal: '20 Jul 2026', jenis: 'refund', jumlah: 160, saldoSetelah: 12450, keterangan: 'Versi gagal dibuat — kredit dikembalikan penuh untuk versi tersebut' },
  { id: 'k8', tanggal: '20 Jul 2026', jenis: 'settle', jumlah: 0, saldoSetelah: 12450, keterangan: 'Bab 1 Adegan 1 selesai — menunggu peninjauanmu' },
]

// ============================================================
// Aktivitas terbaru
// ============================================================

export const activities: Activity[] = [
  { id: 'a1', waktu: '2 jam lalu', teks: 'Kamu menerima Versi 1 untuk Bab 1 · Adegan 1.', jenis: 'tulis' },
  { id: 'a2', waktu: '2 jam lalu', teks: 'Cek Cerita: 2 lolos, 1 peringatan pada adegan yang diterima.', jenis: 'cek' },
  { id: 'a3', waktu: 'Kemarin', teks: 'Narra mengusulkan fakta baru berisiko tinggi — menunggu tinjauanmu.', jenis: 'fakta' },
  { id: 'a4', waktu: 'Kemarin', teks: 'Rencana 10 bab pertama selesai disusun.', jenis: 'rencana' },
  { id: 'a5', waktu: '2 hari lalu', teks: 'Karakter Ratri diperbarui: motivasi dan aturan panggilan.', jenis: 'karakter' },
  { id: 'a6', waktu: '2 hari lalu', teks: 'Draf Fondasi Cerita dibuat dari konsep yang kamu pilih.', jenis: 'fondasi' },
]

// ============================================================
// Tier kualitas (mode kualitas, bukan harga)
// ============================================================

export const tiers: Tier[] = [
  {
    id: 'hemat',
    nama: 'Hemat',
    deskripsi: 'Untuk menjajal ide dan menyusun kerangka dengan biaya paling ringan.',
    ciri: ['Cocok untuk brainstorming dan konsep', 'Prosa lebih ringkas', 'Cek otomatis dasar'],
    aktif: false,
  },
  {
    id: 'seimbang',
    nama: 'Seimbang',
    deskripsi: 'Keseimbangan kualitas dan biaya untuk menulis serial rutin.',
    ciri: ['Prosa penuh per adegan', '3 versi kandidat per permintaan', 'Cek Cerita lengkap'],
    aktif: true,
  },
  {
    id: 'terbaik',
    nama: 'Terbaik',
    deskripsi: 'Kualitas tertinggi untuk bab penting, klimaks, atau naskah yang mau langsung dipoles.',
    ciri: ['Prosa paling halus', 'Analisis karakter lebih dalam', 'Prioritas antrean pemrosesan'],
    aktif: false,
  },
]
