// Page de test des briques de base (étape 1 du plan). Ouvre l'appli avec ?briques pour la voir.
import { useState, type ReactNode } from "react";
import {
  AvatarStack, Badge, Band, BandFoot, Card, DishCard, QuotaBar, Chip, Chips, Dialog, EmptyState, Field, Icon, ListRow, ListSection, LockPill, Pill,
  RoundButton, ScreenHeader, SearchField, Segmented, Sheet, TabBar, TextLink, Toast, Toggle, type TabId,
} from "./components";
import { ArtBag, ArtBell, ArtFridge, ArtRecipeBox } from "./art";
import { ICONS, type IconName } from "./icons";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12, padding: "18px 18px 0" }}>
      <span className="label">{title}</span>
      {children}
    </section>
  );
}

const row = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" } as const;

export default function Showcase() {
  const [chip, setChip] = useState("soir");
  const [plan, setPlan] = useState<"mois" | "an">("an");
  const [tg, setTg] = useState(true);
  const [tab, setTab] = useState<TabId>("home");
  const [isPlus, setIsPlus] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [email, setEmail] = useState("camille@");

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  return (
    <div className="fa" style={{ minHeight: "100svh", maxWidth: 520, margin: "0 auto", paddingBottom: 120 }}>
      <ScreenHeader
        left={<RoundButton icon="back" label="Retour" big />}
        right={<RoundButton icon="cam" label="Nouveau scan" big />}
        title={<>Les <em>briques</em></>}
        sub="Étape 1 du plan : tout ce qui sert à construire les écrans"
      />

      <Block title="Titres et textes">
        <h2 className="stitle">Qu'est-ce qu'on mange <em>ce soir&nbsp;?</em></h2>
        <p>Texte courant en Hanken Grotesk, 15 px. <span className="muted">Texte secondaire plus doux.</span></p>
        <TextLink onClick={() => showToast("Lien touché")}>Un lien souligné</TextLink>
      </Block>

      <Block title="Boutons">
        <Pill block icon="cam">Scanner mon frigo</Pill>
        <div style={row}>
          <Pill tone="line">Plus tard</Pill>
          <Pill tone="danger">Oui, résilier</Pill>
          <Pill disabled>Indisponible</Pill>
        </div>
        <div style={{ ...row, background: "var(--sage)", padding: 12, borderRadius: 18 }}>
          <Pill tone="cream">Voir la recette</Pill>
          <RoundButton icon="bell" label="Notifications" tone="glass" />
          <RoundButton icon="x" label="Fermer" tone="dark" />
        </div>
      </Block>

      <Block title="Pastilles, badges">
        <Chips>
          {[["midi", "Ce midi"], ["soir", "Ce soir"], ["semaine", "La semaine"]].map(([v, l]) => (
            <Chip key={v} on={chip === v} onClick={() => setChip(v)}>{l}</Chip>
          ))}
        </Chips>
        <div style={row}>
          <Badge icon="clock">20 min</Badge>
          <Badge tone="warn" icon="sparkle">Plus</Badge>
          <LockPill />
        </div>
      </Block>

      <Block title="Cartes">
        <span className="muted" style={{ fontSize: 13 }}>Bandeau de l'accueil en Gratuit</span>
        <Band label="Mardi · 18 h 42 · Bonsoir Camille" title={<>Qu'est-ce qu'on mange <em>ce soir&nbsp;?</em></>}>
          <p>Prends ton frigo en photo. Trois idées pour toute la famille, avec ce que tu as.</p>
          <Pill tone="cream" icon="cam">Scanner mon frigo</Pill>
          <BandFoot><QuotaBar used={13} total={15} />2 scans gratuits restants sur 15</BandFoot>
        </Band>
        <span className="muted" style={{ fontSize: 13 }}>Bandeau de l'accueil en Plus, quand un plat est prévu</span>
        <Band label="Mardi · 18 h 42 · Bonsoir Camille" title={<>Ce soir, c'est <em>prévu</em></>}>
          <DishCard img="/landing/pasta-legumes.jpg" title="Penne aux légumes rôtis" meta="25 min · 3 portions" onClick={() => showToast("Recette ouverte")} />
          <Pill tone="ghost" icon="cam">Scanner mon frigo</Pill>
          <BandFoot><AvatarStack names={["Camille", "Thomas", "Léo", "Jade"]} />Pour 4 ce soir : Camille, Thomas, Léo et Jade</BandFoot>
        </Band>
        <Card>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <img className="plate" src="/landing/pasta-legumes.jpg" alt="" style={{ width: 58 }} />
            <div><b>Pâtes aux légumes</b><div className="muted" style={{ fontSize: 13 }}>Hier soir · 3 portions</div></div>
          </div>
        </Card>
      </Block>

      <Block title="Champs">
        <Field label="Ton email" icon="mail" type="email" value={email} onChange={e => setEmail(e.target.value)}
          error={/^\S+@\S+\.\S+$/.test(email) ? undefined : "Cet email n'a pas l'air complet"} />
        <SearchField placeholder="Une recette, un ingrédient…" aria-label="Chercher" />
        <Segmented label="Formule" value={plan} onChange={setPlan}
          options={[{ value: "mois", label: "Mensuel" }, { value: "an", label: "Annuel" }]} />
      </Block>

      <Block title="Réglages">
        <div>
          <ListSection title="Ton compte">
            <ListRow icon="sparkle" title="Abonnement" value="Gratuit" onClick={() => showToast("Abonnement")} />
            <ListRow icon="gift" title="Utiliser un code" value="Ami ou créateur" onClick={() => showToast("Code")} />
          </ListSection>
          <ListSection title="Notifications">
            <ListRow title="L'idée du soir" sub="Vers 18 h, ce que ton frigo permet" control={<Toggle label="L'idée du soir" checked={tg} onChange={setTg} />} />
          </ListSection>
          <ListSection>
            <ListRow icon="logout" title="Se déconnecter" danger onClick={() => showToast("Déconnexion")} />
          </ListSection>
        </div>
      </Block>

      <Block title="Feuilles et messages">
        <div style={row}>
          <Pill tone="line" onClick={() => setSheet(true)}>Grande feuille</Pill>
          <Pill tone="line" onClick={() => setDialog(true)}>Petite feuille</Pill>
          <Pill tone="line" onClick={() => showToast("Ajouté à ta liste de courses")}>Message</Pill>
        </div>
      </Block>

      <Block title="États vides">
        <Card><EmptyState art={<ArtFridge />} title={<>Aucun <em>scan</em> pour l'instant</>} text="Prends ton frigo en photo, on te propose trois idées." action={<Pill icon="cam">Scanner mon frigo</Pill>} /></Card>
        <Card><EmptyState art={<ArtRecipeBox />} title={<>Pas encore de <em>favori</em></>} /></Card>
        <Card><EmptyState art={<ArtBag />} title={<>Ta liste est <em>vide</em></>} /></Card>
        <Card><EmptyState art={<ArtBell />} title={<>Rien de <em>nouveau</em></>} /></Card>
      </Block>

      <Block title={`Icônes (${Object.keys(ICONS).length})`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(64px,1fr))", gap: 8 }}>
          {(Object.keys(ICONS) as IconName[]).map(n => (
            <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)" }}>
              <Icon name={n} />{n}
            </div>
          ))}
        </div>
      </Block>

      <Block title="Barre d'onglets">
        <div style={row}>
          <Chip on={!isPlus} onClick={() => setIsPlus(false)}>Voir en Gratuit</Chip>
          <Chip on={isPlus} onClick={() => setIsPlus(true)}>Voir en Plus</Chip>
        </div>
      </Block>

      <TabBar active={tab} isPlus={isPlus} onTab={setTab} onScan={() => showToast("Scan")} />
      <Toast message={toast} />

      <Sheet open={sheet} onClose={() => setSheet(false)} label="Ajouter un ingrédient">
        <h3 className="stitle">Ajouter un <em>ingrédient</em></h3>
        <SearchField placeholder="Tomates, œufs, riz…" aria-label="Chercher un ingrédient" />
        <Chips>{["Œufs", "Tomates", "Riz", "Courgette", "Fromage"].map(x => <Chip key={x}>{x}</Chip>)}</Chips>
        <Pill block onClick={() => setSheet(false)}>Ajouter</Pill>
      </Sheet>

      <Dialog open={dialog} onClose={() => setDialog(false)} icon="gift" badge="?" title={<>Code <em>introuvable</em></>}>
        <p>On ne trouve pas ce code. Vérifie l'orthographe, ou continue sans.</p>
        <Pill block onClick={() => setDialog(false)}>Corriger le code</Pill>
        <TextLink onClick={() => setDialog(false)}>Continuer sans code</TextLink>
      </Dialog>
    </div>
  );
}
