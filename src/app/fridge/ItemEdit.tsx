// Changer le nom et la quantité d'un produit, sur place : à « C'est bien ça ? » après un scan, et dans Ma cuisine.
// Entrée ou ✓ enregistre, Échap annule ; toucher ailleurs enregistre aussi.
import { useState } from "react";
import { Icon } from "../../ui/components";

export function ItemEdit({ name, qty, focus, onSave, onCancel }: {
  name: string; qty: string; focus: "name" | "qty";
  onSave: (name: string, qty: string) => void; onCancel: () => void;
}) {
  const [n, setN] = useState(name);
  const [q, setQ] = useState(qty);
  const save = () => (n.trim() ? onSave(n.trim().charAt(0).toUpperCase() + n.trim().slice(1), q.trim()) : onCancel());
  return (
    <form className="ied" onSubmit={e => { e.preventDefault(); save(); }}
      onKeyDown={e => { if (e.key === "Escape") onCancel(); }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) save(); }}>
      <input className="ied-n" value={n} onChange={e => setN(e.target.value)} aria-label="Nom" maxLength={60} autoFocus={focus === "name"} enterKeyHint="done" />
      <input className="ied-q" value={q} onChange={e => setQ(e.target.value)} aria-label="Quantité" placeholder="Quantité" maxLength={30} autoFocus={focus === "qty"} enterKeyHint="done" />
      <button type="submit" aria-label="Enregistrer"><Icon name="check" /></button>
    </form>
  );
}
