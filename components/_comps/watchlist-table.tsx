"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Plus, Edit, Trash2, MoreVertical } from "lucide-react";
import { MIZVA_URL } from "@/backend_integration/api_mizva";

type Group = { id: number; name: string };
type WatchlistItem = {
  person_id: number;
  person_name: string;
  group_id?: number;
  embeddings: number[][];
  images?: string[];
  thumb_relpath?: string | null;
};

export function WatchlistTable() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [open, setOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyingPerson, setModifyingPerson] = useState<WatchlistItem | null>(
    null
  );
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const g = await fetch(`${MIZVA_URL}/api/watchlist/groups`).then((r) =>
        r.json()
      );
      const wl = await fetch(`${MIZVA_URL}/api/watchlist`).then((r) =>
        r.json()
      );
      setGroups(g.groups || []);
      setItems(wl.watchlist || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addPerson = async () => {
    if (!name.trim() || !imageFile) return;
    setBusy(true);
    try {
      // ensure group exists/selected; if none, create a default group "Default"
      let gid = groupId;
      if (!gid) {
        const res = await fetch(`${MIZVA_URL}/api/watchlist/groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Default" }),
        });
        const j = await res.json();
        gid = j.id;
      }
      // create person
      const pr = await fetch(`${MIZVA_URL}/api/watchlist/person`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, group_id: gid }),
      });
      const pj = await pr.json();
      const pid = pj.id;
      // upload image to embed & store
      const fd = new FormData();
      fd.append("person_id", String(pid));
      fd.append("image", imageFile);
      const ur = await fetch(`${MIZVA_URL}/api/watchlist/person_image`, {
        method: "POST",
        body: fd,
      });
      if (!ur.ok) {
        throw new Error(await ur.text());
      }
      // reload
      await load();
      setName("");
      setGroupId(undefined);
      setImageFile(null);
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to add person");
    } finally {
      setBusy(false);
    }
  };

  const deletePerson = async (personId: number) => {
    if (!confirm("Are you sure you want to delete this person?")) return;
    setBusy(true);
    try {
      const res = await fetch(`${MIZVA_URL}/api/watchlist/person/${personId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      await load();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to delete person");
    } finally {
      setBusy(false);
    }
  };

  const openModifyDialog = (person: WatchlistItem) => {
    setModifyingPerson(person);
    setName(person.person_name);
    setGroupId(person.group_id);
    setImageFile(null);
    setModifyOpen(true);
  };

  const modifyPerson = async () => {
    if (!modifyingPerson || !name.trim()) return;
    setBusy(true);
    try {
      // Update person name and group
      const res = await fetch(
        `${MIZVA_URL}/api/watchlist/person/${modifyingPerson.person_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, group_id: groupId }),
        }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }

      // If new image provided, upload it
      if (imageFile) {
        const fd = new FormData();
        fd.append("person_id", String(modifyingPerson.person_id));
        fd.append("image", imageFile);
        const ur = await fetch(`${MIZVA_URL}/api/watchlist/person_image`, {
          method: "POST",
          body: fd,
        });
        if (!ur.ok) {
          throw new Error(await ur.text());
        }
      }

      // reload
      await load();
      setName("");
      setGroupId(undefined);
      setImageFile(null);
      setModifyingPerson(null);
      setModifyOpen(false);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to modify person");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Watchlist
        </h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Person
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No persons in watchlist
          </h3>
          <p className="text-muted-foreground mb-4">
            Start by adding people to monitor and recognize.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Person
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((p) => (
            <Card
              key={p.person_id}
              className="relative overflow-hidden bg-card/70 backdrop-blur-xl border animate-in fade-in duration-700"
            >
              <CardContent className="p-0">
                {/* Image Section */}
                <div className="relative aspect-[3/4] bg-gray-100">
                  {p.thumb_relpath ? (
                    <img
                      src={`${MIZVA_URL}/data/${p.thumb_relpath.replace(
                        /\\/g,
                        "/"
                      )}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const fallback =
                          target.nextElementSibling as HTMLElement;
                        if (fallback) {
                          fallback.classList.remove("hidden");
                          fallback.classList.add("flex");
                        }
                      }}
                      alt={p.person_name}
                    />
                  ) : null}
                  <div className="w-full h-full bg-gray-100 items-center justify-center text-sm text-gray-500 hidden">
                    No Image
                  </div>

                  {/* Action Buttons Overlay */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openModifyDialog(p)}
                      disabled={busy}
                      className="h-8 w-8 p-0 bg-white/80 hover:bg-white"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deletePerson(p.person_id)}
                      disabled={busy}
                      className="h-8 w-8 p-0 bg-white/80 hover:bg-white text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Info Section */}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-lg truncate">
                    {p.person_name}
                  </h3>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {groups.find((g) => g.id === p.group_id)?.name ||
                        "Default"}
                    </span>
                    <span className="bg-secondary px-2 py-1 rounded text-xs">
                      FID: {p.person_id}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.embeddings?.length || 0} embedding
                    {(p.embeddings?.length || 0) !== 1 ? "s" : ""}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Person</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">Group (optional)</label>
              <select
                className="border rounded-md h-9 px-2 bg-background"
                value={groupId ?? ""}
                onChange={(e) =>
                  setGroupId(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">Image</label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={addPerson}
              disabled={busy || !name.trim() || !imageFile}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Person</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">Group (optional)</label>
              <select
                className="border rounded-md h-9 px-2 bg-background"
                value={groupId ?? ""}
                onChange={(e) =>
                  setGroupId(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">
                Image (optional - only if changing)
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModifyOpen(false);
                setModifyingPerson(null);
                setName("");
                setGroupId(undefined);
                setImageFile(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={modifyPerson} disabled={busy || !name.trim()}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WatchlistTable;
