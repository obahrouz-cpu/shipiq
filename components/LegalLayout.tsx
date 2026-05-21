import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import styles from '@/app/legal.module.css'

type Block =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }

export type LegalSection = {
  id: string
  title: string
  blocks: Block[]
}

type Props = {
  titleEn: string
  titleAr: string
  lastUpdated: string
  sections: LegalSection[]
}

export default function LegalLayout({ titleEn, titleAr, lastUpdated, sections }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.logo} aria-label="ShipIQ home">ShipIQ</Link>
        <div className={styles.topbarActions}>
          <ThemeToggle />
          <Link href="/" className={styles.backBtn}>← Back to Home · الرئيسية</Link>
        </div>
      </header>

      <main className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            {titleEn}
            <span className={styles.titleDot}>·</span>
            <span className={styles.titleAr}>{titleAr}</span>
          </h1>
          <div className={styles.updated}>Last updated: {lastUpdated}</div>
        </div>

        <nav className={styles.toc} aria-label="Table of contents">
          <div className={styles.tocTitle}>Contents · المحتويات</div>
          <ol className={styles.tocList}>
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={styles.tocLink}>
                  <span className={styles.tocNum}>{i + 1}.</span>{s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionNum}>{i + 1}.</span>
              <span>{s.title}</span>
            </h2>
            {s.blocks.map((block, j) =>
              block.type === 'p' ? (
                <p key={j} className={styles.paragraph}>{block.text}</p>
              ) : (
                <ul key={j} className={styles.list}>
                  {block.items.map((item, k) => (
                    <li key={k} className={styles.listItem}>{item}</li>
                  ))}
                </ul>
              )
            )}
          </section>
        ))}

        <footer className={styles.footer}>
          <div className={styles.footerLinks}>
            <Link href="/privacy" className={styles.footerLink}>Privacy Policy · سياسة الخصوصية</Link>
            <Link href="/terms" className={styles.footerLink}>Terms of Service · شروط الخدمة</Link>
            <Link href="/" className={styles.footerLink}>Home · الرئيسية</Link>
          </div>
          <div className={styles.footerCopy}>
            © 2025 ShipIQ · Erbil &amp; Baghdad, Iraq 🇮🇶
          </div>
        </footer>
      </main>
    </div>
  )
}
