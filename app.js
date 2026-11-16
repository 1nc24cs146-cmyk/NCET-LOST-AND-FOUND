// LostLink — NCET Lost & Found | Team LostLink, INNOVATE 2.0, 14 Nov 2026
// Plain HTML/CSS/JS, no build step. Supabase for auth + database + storage;
// Demo Mode (localStorage, dummy data only) when supabase.js is still a placeholder.
import { supabase, isSupabaseConfigured, uploadPhotoToSupabase, BREVO_API_KEY, BREVO_SENDER, isEmailConfigured } from "./supabase.js";

/* ---------- Shared constants (Prompts 1, 7) ---------- */
export const BRANCHES = { cs:"CSE", is:"ISE", cd:"Data Science", ci:"AIML", ec:"ECE", cv:"Civil", ic:"IoT / Cyber Security" };
export const BRANCH_LABEL = { cs:"CSE (CS)", is:"ISE (IS)", cd:"Data Science (CD)", ci:"AIML (CI)", ec:"ECE (EC)", cv:"Civil (CV)", ic:"IoT / Cyber Security (IC)" };
export const EMAIL_RE = /^1nc[0-9]{2}(cs|is|cd|ci|ec|cv|ic)[0-9]{3}@ncetmail\.com$/;
/* ---------- HOD logins ---------- */
// Workers who find an item have no login — they hand it to the department, and
// the HOD posts it from a separate department login: hod-<branch>@ncetmail.com
// (e.g. hod-cs@ncetmail.com). The HOD then accepts or rejects claims for
// their department's items from their Profile.
export const HOD_EMAIL_RE = /^hod-(cs|is|cd|ci|ec|cv|ic)@ncetmail\.com$/;
export function hodFromEmail(email) {
  const m = (email || "").trim().toLowerCase().match(HOD_EMAIL_RE);
  if (!m) return null;
  const branchCode = m[1];
  return { branchCode, department: BRANCHES[branchCode], usn: "HOD-" + branchCode.toUpperCase(), email: "hod-" + branchCode + "@ncetmail.com" };
}
export const isHodEmail = (email) => !!hodFromEmail(email);
const HOD_COLLECT_DEPT = { cs:"CSE", is:"ISE", cd:"CSE (Data Science)", ci:"CSE (AI/ML)", ec:"ECE", cv:"Civil", ic:"CSE (IoT & Cyber Security)" };
export const CATEGORIES = ["Charger","Adapter","ID Card","Books","Laptop Charger","Laptop","Sports Item","Others"];
export const COLLECT_DEPTS = ["CSE","CSE (AI/ML)","ECE","ISE","CSE (Data Science)","Civil","CSE (IoT & Cyber Security)","BCA","MBA","MCA"];

/** Shared validation — run BEFORE any Supabase call (Prompt 1). */
export function validateCollegeEmailAndUsn(emailRaw, usnRaw) {
  const email = (emailRaw || "").trim().toLowerCase();
  const usn = (usnRaw || "").trim().toUpperCase();
  if (!EMAIL_RE.test(email))
    return { ok:false, field:"email", error:"Use your USN college email — example: 1nc24cs146@ncetmail.com" };
  if (!usn) return { ok:false, field:"usn", error:"USN is required." };
  if (usn !== email.split("@")[0].toUpperCase())
    return { ok:false, field:"usn", error:"Your USN must match your college email — example: USN 1NC24CS146 = 1nc24cs146@ncetmail.com" };
  const branchCode = email.slice(5, 7);
  const year = email.slice(3, 5);
  return { ok:true, email, usn, branchCode, department: BRANCHES[branchCode], year };
}
const isMobile = (m) => /^[0-9]{10}$/.test((m || "").trim());
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const STOP = new Set("the a an and or of on in at to for with is it this that my was were are has have had by from as".split(" "));
function strongWords(text) {
  return [...new Set((text || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)))];
}
function isPossibleMatch(found, complaint) {
  if (found.category !== complaint.category) return false;
  // Item name alone is NOT a match: a single shared word that is only
  // the item/category name does not count. A match needs either a
  // shared description word outside the item name (colour/brand/mark),
  // or at least 2 shared strong words.
  const catWords = new Set((found.category || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const nameWords = new Set(((found.itemName || "") + " " + (complaint.itemName || "")).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const a = strongWords(found._desc || "").filter((w) => !catWords.has(w));
  const b = strongWords(complaint._desc || "").filter((w) => !catWords.has(w));
  const shared = a.filter((w) => b.includes(w));
  if (!shared.length) return false;
  if (shared.some((w) => !nameWords.has(w))) return true;
  return shared.length >= 2;
}

/* ---------- Demo Mode store (localStorage, dummy data only) ---------- */
const DEMO_KEY = "lostlink_demo_v2";
function seedDemo() {
  // No demo logins: everyone creates their own account with their NCET mail.
  // Board starts empty; users post their own found items and complaints.
  return { users: [], foundItems: [], foundPrivate: {},
    complaints: [], complaintPrivate: {}, matches: [], feedback: [] };
}
function loadDemo() { try { const d = JSON.parse(localStorage.getItem(DEMO_KEY)); if (d && d.users) return d; } catch(e){} const d = seedDemo(); localStorage.setItem(DEMO_KEY, JSON.stringify(d)); return d; }
function saveDemo(d) { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); }

/* ---------- Supabase ---------- */
const DEMO = !isSupabaseConfigured;
// Email notifications via Brevo. Non-blocking: a mail failure never
// breaks the complaint/match flow. Owner mail = USN mail address.
const usnToEmail = (usn) => (usn || "").toLowerCase() + "@ncetmail.com";
async function sendMail(to, subject, html) {
  if (!isEmailConfigured || !to) return false;
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST",
      headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
      body: JSON.stringify({ sender: BREVO_SENDER, to: [{ email: to }], subject, htmlContent: html }) });
    return r.ok;
  } catch (e) { return false; }
}
const mailWrap = (title, body) => `<div style="font-family:Arial,sans-serif;color:#0e2455"><h2 style="color:#0e2455">${title}</h2><p>${body}</p><p style="color:#666;font-size:13px">LostLink — NCET Lost &amp; Found<br>Nagarjuna College of Engineering &amp; Technology, Devanahalli, Bengaluru</p></div>`;

let currentUser = null; // {uid,email,usn,department,branchCode,year,name,mobile,role}
let feedbackDue = false; // true when the owner has a delivered item with no feedback yet — feedback is compulsory
let selectedPhoto = null; // the photo picked via Take Photo or Upload Photo
let activeCategory = "All";
let searchText = "";

/* Unified data layer — same shapes in both modes. Private fields are
   only returned to their owner, or to the other party after Confirmed. */
/* Unified data layer — same shapes in both modes. Private fields are
   only returned to their owner, or to the other party after Confirmed. */
const toSnakePatch = (patch) => {
  const map = { matchStatus: "match_status", itemStatus: "item_status", status: "status", name: "name", mobile: "mobile" };
  const out = {};
  for (const k of Object.keys(patch)) if (map[k] !== undefined) out[map[k]] = patch[k];
  return out;
};
const mapProfile = (r) => r ? { uid: r.id, email: r.email, usn: r.usn, department: r.department, branchCode: r.branch_code, year: r.year, name: r.name || "", mobile: r.mobile || "", role: isHodEmail(r.email) ? "hod" : "student" } : null;
const mapFound = (r) => ({ id: r.id, itemName: r.item_name, category: r.category, placeFound: r.place_found, dateFound: r.date_found || "", collectDept: r.collect_dept, status: r.status, photoUrl: r.photo_url || "", finderUsn: r.finder_usn, finderName: r.finder_name || "", uploaderName: r.uploader_name || "", uploaderUid: r.uploader_uid });
const mapComplaint = (r) => ({ id: r.id, itemName: r.item_name, category: r.category, ownerUsn: r.owner_usn, ownerUid: r.owner_uid, foundItemId: r.found_item_id, matchStatus: r.match_status, itemStatus: r.item_status, date: (r.created_at || "").slice(0, 10) });
const mapMatch = (r) => ({ id: r.id, complaintId: r.complaint_id, foundItemId: r.found_item_id, ownerUid: r.owner_uid, ownerUsn: r.owner_usn, finderUid: r.finder_uid, finderUsn: r.finder_usn, status: r.status });
const mapFeedback = (r) => ({ id: r.id, foundItemId: r.found_item_id, authorUid: r.author_uid, usn: r.usn, rating: r.rating, comment: r.comment || "", message: r.comment || "" });
const DB = {
  async signIn(email, usn, password) {
    if (!DEMO) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      let profile = await this.getProfile(data.user.id);
      if (!profile) {
        // Profile row missing (e.g. created before the users table existed):
        // rebuild it from the auth metadata saved at sign-up.
        const meta = data.user.user_metadata || {};
        const hod = hodFromEmail(email);
        const row = hod
          ? { id: data.user.id, email: hod.email, usn: hod.usn, department: hod.department, branch_code: hod.branchCode, year: "", name: "HOD — " + hod.department, mobile: "" }
          : (() => { const v = validateCollegeEmailAndUsn(email, usn); if (!v.ok) throw new Error("Profile not found. Please create an account first."); return { id: data.user.id, email, usn, department: v.department, branch_code: v.branchCode, year: v.year, name: meta.full_name || meta.name || "", mobile: "" }; })();
        const { error: ierr } = await supabase.from("users").insert(row);
        if (ierr) throw new Error("Profile not found. Please create an account first.");
        profile = mapProfile(row);
      }
      return profile;
    }
    const d = loadDemo();
    const u = d.users.find((x) => x.email === email);
    if (!u) throw new Error("Account not found. Please create an account first.");
    if (u.password !== password) throw new Error("Wrong password.");
    if (u.usn !== usn) throw new Error("USN does not match this account.");
    return { ...u };
  },
  async signUp(email, usn, password, v) {
    if (!DEMO) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { usn, department: v.department, branch_code: v.branchCode, year: v.year } } });
      if (error) throw error;
      if (!data.user) throw new Error("Sign-up failed. Please try again.");
      if (!data.session) throw new Error("Account created — please confirm your email (check your NCET mail), then log in.");
      const row = { id: data.user.id, email, usn, department: v.department, branch_code: v.branchCode, year: v.year, name: "", mobile: "" };
      const { error: perr } = await supabase.from("users").insert(row);
      if (perr) throw perr;
      return { uid: data.user.id, email, usn, department: v.department, branchCode: v.branchCode, year: v.year, name: "", mobile: "" };
    }
    const d = loadDemo();
    if (d.users.some((x) => x.email === email)) throw new Error("Email already in use.");
    const u = { uid: uid(), email, usn, department: v.department, branchCode: v.branchCode, year: v.year, name: "", mobile: "", password };
    d.users.push(u); saveDemo(d); return { ...u };
  },
  async signInWithGoogle() {
    if (!DEMO) {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/index.html", queryParams: { hd: "ncetmail.com", prompt: "select_account" } } });
      if (error) throw error;
      return null; // page redirects to Google; restoreSession handles the return
    }
    throw new Error("Connect Supabase to use Continue with NCET Mail. For now, create an account with your NCET mail and password.");
  },
  async getProfile(uid_) {
    if (!DEMO) {
      const { data, error } = await supabase.from("users").select("*").eq("id", uid_).maybeSingle();
      if (error) throw error;
      return mapProfile(data);
    }
    const d = loadDemo(); return d.users.find((x) => x.uid === uid_) || null;
  },
  async updateProfile(uid_, patch) {
    if (!DEMO) {
      const row = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.mobile !== undefined) row.mobile = patch.mobile;
      const { error } = await supabase.from("users").update(row).eq("id", uid_);
      if (error) throw error;
      return;
    }
    const d = loadDemo(); const u = d.users.find((x) => x.uid === uid_); Object.assign(u, patch); saveDemo(d);
  },
  async listFoundPublic() {
    if (!DEMO) {
      const { data, error } = await supabase.from("found_items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapFound);
    }
    const d = loadDemo();
    return d.foundItems.map((x) => ({ id: x.id, itemName: x.itemName, category: x.category, placeFound: x.placeFound, dateFound: x.dateFound, collectDept: x.collectDept, status: x.status, photoUrl: x.photoUrl, finderUsn: x.finderUsn, uploaderUid: x.uploaderUid }));
  },
  async createFound(pub, priv, photoFile) {
    if (!DEMO) {
      const { data: row, error } = await supabase.from("found_items").insert({
        item_name: pub.itemName, category: pub.category, place_found: pub.placeFound,
        date_found: today(), collect_dept: pub.collectDept, status: pub.status || "Pending",
        photo_url: pub.photoUrl || "", finder_usn: pub.finderUsn, finder_name: pub.finderName,
        uploader_name: pub.uploaderName, uploader_uid: pub.uploaderUid
      }).select("id").single();
      if (error) throw error;
      const id = row.id;
      if (photoFile) {
        let photoUrl = "";
        try { photoUrl = await uploadPhotoToSupabase(photoFile, `${id}/${photoFile.name}`); }
        catch (e) { console.warn("Photo upload skipped (Storage not available yet):", e); }
        if (photoUrl) await supabase.from("found_items").update({ photo_url: photoUrl }).eq("id", id);
      } // item still saves without a photo
      const { error: perr } = await supabase.from("found_items_private").insert({ item_id: id, mobile: priv.mobile, description: priv.description });
      if (perr) throw perr;
      return id;
    }
    const d = loadDemo(); const id = uid();
    const item = { id, ...pub, dateFound: today(), createdAt: Date.now() };
    if (photoFile) item.photoUrl = await fileToDataUrl(photoFile);
    d.foundItems.push(item); d.foundPrivate[id] = priv; saveDemo(d); return id;
  },
  async createComplaint(pub, priv) {
    if (!DEMO) {
      const { data: row, error } = await supabase.from("complaints").insert({
        item_name: pub.itemName, category: pub.category, owner_usn: pub.ownerUsn, owner_uid: pub.ownerUid,
        found_item_id: pub.foundItemId || null, match_status: pub.matchStatus || "Waiting for Match",
        item_status: pub.itemStatus || "Pending"
      }).select("id").single();
      if (error) throw error;
      const { error: perr } = await supabase.from("complaints_private").insert({ complaint_id: row.id, mobile: priv.mobile, description: priv.description });
      if (perr) throw perr;
      return row.id;
    }
    const d = loadDemo(); const id = uid();
    d.complaints.push({ id, ...pub, date: today() }); d.complaintPrivate[id] = priv; saveDemo(d); return id;
  },
  async listMyComplaints(uid_) {
    if (!DEMO) {
      const { data, error } = await supabase.from("complaints").select("*").eq("owner_uid", uid_).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapComplaint);
    }
    return loadDemo().complaints.filter((c) => c.ownerUid === uid_);
  },
  async listAllComplaints() {
    if (!DEMO) {
      const { data, error } = await supabase.from("complaints").select("*");
      if (error) throw error;
      return (data || []).map(mapComplaint);
    }
    return loadDemo().complaints;
  },
  async listMatches(uid_) {
    // Owner-only: a match shows only in that complaint owner's Profile and
    // Matches. The finder and everyone else never see it.
    if (!DEMO) {
      const { data, error } = await supabase.from("matches").select("*").eq("owner_uid", uid_).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapMatch);
    }
    const d = loadDemo(); return d.matches.filter((m) => m.ownerUid === uid_);
  },
  async listAllMatches() {
    if (!DEMO) {
      const { data, error } = await supabase.from("matches").select("*");
      if (error) throw error;
      return (data || []).map(mapMatch);
    }
    return loadDemo().matches;
  },
  async getPrivate(kind, id, requesterUid) {
    // kind: "found" | "complaint". Owner always; other party only after Confirmed.
    if (!DEMO) {
      const parentTable = kind === "found" ? "found_items" : "complaints";
      const parentIdCol = kind === "found" ? "item_id" : "complaint_id";
      const ownerCol = kind === "found" ? "uploader_uid" : "owner_uid";
      const { data: parent } = await supabase.from(parentTable).select(`id,${ownerCol}`).eq("id", id).maybeSingle();
      if (!parent) return null;
      let allowed = requesterUid === parent[ownerCol];
      if (!allowed) {
        const matchCol = kind === "found" ? "found_item_id" : "complaint_id";
        const { data: m } = await supabase.from("matches").select("id").eq(matchCol, id).eq("status", "Confirmed").or(`owner_uid.eq.${requesterUid},finder_uid.eq.${requesterUid}`).limit(1);
        allowed = !!(m && m.length);
      }
      if (!allowed) return null;
      const privTable = kind === "found" ? "found_items_private" : "complaints_private";
      const { data: priv } = await supabase.from(privTable).select("mobile,description").eq(parentIdCol, id).maybeSingle();
      return priv || null;
    }
    const d = loadDemo();
    const ownerUid = kind === "found" ? d.foundItems.find((x) => x.id === id)?.uploaderUid : d.complaints.find((x) => x.id === id)?.ownerUid;
    const confirmed = d.matches.some((m) => m.status === "Confirmed" && ((kind === "found" && m.foundItemId === id) || (kind === "complaint" && m.complaintId === id)) && (m.ownerUid === requesterUid || m.finderUid === requesterUid));
    if (requesterUid !== ownerUid && !confirmed) return null;
    return kind === "found" ? d.foundPrivate[id] : d.complaintPrivate[id];
  },
  async listFeedback() {
    if (!DEMO) {
      const { data, error } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapFeedback);
    }
    return loadDemo().feedback;
  },
  async submitFeedback(fb) {
    if (!DEMO) {
      const { error } = await supabase.from("feedback").insert({ found_item_id: fb.foundItemId, author_uid: fb.authorUid, usn: fb.usn, rating: fb.rating, comment: fb.message || fb.comment || "" });
      if (error) throw error;
      return;
    }
    const d = loadDemo(); d.feedback.push({ id: uid(), ...fb, date: today() }); saveDemo(d);
  },
  async updateMatch(id, patch) {
    if (!DEMO) {
      const snake = toSnakePatch(patch);
      if (Object.keys(snake).length) {
        const { error } = await supabase.from("matches").update(snake).eq("id", id);
        if (error) throw error;
      }
      return;
    }
    const d = loadDemo(); Object.assign(d.matches.find((m) => m.id === id), patch); saveDemo(d);
  },
  async updateComplaint(id, patch) {
    if (!DEMO) {
      const snake = toSnakePatch(patch);
      if (Object.keys(snake).length) {
        const { error } = await supabase.from("complaints").update(snake).eq("id", id);
        if (error) throw error;
      }
      return;
    }
    const d = loadDemo(); Object.assign(d.complaints.find((c) => c.id === id), patch); saveDemo(d);
  },
  async updateFound(id, patch) {
    if (!DEMO) {
      const snake = toSnakePatch(patch);
      if (Object.keys(snake).length) {
        const { error } = await supabase.from("found_items").update(snake).eq("id", id);
        if (error) throw error;
      }
      return;
    }
    const d = loadDemo(); Object.assign(d.foundItems.find((x) => x.id === id), patch); saveDemo(d);
  },
  async addMatch(m) {
    if (!DEMO) {
      const { data, error } = await supabase.from("matches").insert({ complaint_id: m.complaintId, found_item_id: m.foundItemId, owner_uid: m.ownerUid, owner_usn: m.ownerUsn, finder_uid: m.finderUid, finder_usn: m.finderUsn, status: m.status }).select("id").single();
      if (error) throw error;
      return data.id;
    }
    const d = loadDemo(); const id = uid(); d.matches.push({ id, ...m }); saveDemo(d); return id;
  },
};
function fileToDataUrl(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }

/* ---------- Matching (Prompt 5) ---------- */
/* ---------- Confirm a match (shared by Matches page + Profile) ---------- */
// Owner accepts the match. Student-posted items go Delivered straight away;
// department (HOD-posted) items wait for the HOD to accept in their Profile.
async function confirmMatch(m, f) {
  const isHodItem = (f.finderUsn || "").startsWith("HOD-");
  await DB.updateMatch(m.id, { status: "Confirmed", confirmedAt: Date.now() });
  // Both users get each other's details in the mail — name, USN, mobile + the item info.
  let ownerName = m.ownerUsn, finderName = f.finderName || m.finderUsn, ownerMobile = "", finderMobile = "";
  try {
    const op = await DB.getProfile(m.ownerUid); if (op?.name) ownerName = op.name;
    const fp = await DB.getProfile(m.finderUid); if (fp?.name) finderName = fp.name;
    const oPriv = await DB.getPrivate("complaint", m.complaintId, m.ownerUid); if (oPriv?.mobile) ownerMobile = oPriv.mobile;
    const fPriv = await DB.getPrivate("found", m.foundItemId, m.finderUid); if (fPriv?.mobile) finderMobile = fPriv.mobile;
  } catch (e) { console.warn("Contact details failed to load:", e); }
  const details = `<br><br><b>Item:</b> ${f ? f.itemName : "your item"} (${f ? f.category : ""}) — found at ${f ? f.placeFound || "" : ""}, collect from ${f ? f.collectDept || "" : ""} department.<br><b>Owner:</b> ${ownerName} (${m.ownerUsn})${ownerMobile ? `, mobile ${ownerMobile}` : ""}<br><b>Finder:</b> ${finderName} (${m.finderUsn})${finderMobile ? `, mobile ${finderMobile}` : ""}`;
  // WhatsApp: the same details, pre-filled in a message — tap the link in the mail to send them on WhatsApp.
  const waText = `LostLink — NCET: Your item has been matched.\nItem: ${f ? f.itemName : "your item"} (${f ? f.category : ""}) — found at ${f ? f.placeFound || "" : ""}, collect from ${f ? f.collectDept || "" : ""} department.\nOwner: ${ownerName} (${m.ownerUsn})${ownerMobile ? `, mobile ${ownerMobile}` : ""}\nFinder: ${finderName} (${m.finderUsn})${finderMobile ? `, mobile ${finderMobile}` : ""}`;
  const waLink = (mobile) => mobile ? `<br><br><a href="https://wa.me/91${mobile}?text=${encodeURIComponent(waText)}">Message on WhatsApp</a>` : "";
  if (isHodItem) {
    await DB.updateComplaint(m.complaintId, { matchStatus: "Confirmed" });
    sendMail(usnToEmail(m.ownerUsn), "LostLink: match confirmed for " + (f ? f.itemName : "your item"),
      mailWrap("Match confirmed — waiting for HOD", `You confirmed the match. The HOD of the ${f ? f.collectDept : ""} department will verify it and hand it over — the item will show <b>Delivered to Owner</b> once they accept.${details}${waLink(finderMobile)}`));
    sendMail(usnToEmail(m.finderUsn), "LostLink: a student confirmed your department item",
      mailWrap("Claim waiting for your approval", `A student confirmed that the <b>${f ? f.itemName : "item"}</b> is theirs. Please open your Profile in LostLink to accept or reject the handover.${details}${waLink(ownerMobile)}`));
  } else {
    await DB.updateFound(m.foundItemId, { status: "Delivered to Owner" });
    await DB.updateComplaint(m.complaintId, { matchStatus: "Confirmed", itemStatus: "Delivered to Owner" });
    sendMail(usnToEmail(m.ownerUsn), "LostLink: match confirmed for " + (f ? f.itemName : "your item"),
      mailWrap("Match confirmed — Delivered to Owner", `You confirmed the match. The item is now marked <b>Delivered to Owner</b> — please collect it from the ${f ? f.collectDept : ""} department.${details}${waLink(finderMobile)}`));
    sendMail(usnToEmail(m.finderUsn), "LostLink: the owner confirmed your found item",
      mailWrap("Match confirmed — Delivered to Owner", `The owner confirmed that the item you found is theirs. It is now marked <b>Delivered to Owner</b> — please hand it over at the ${f ? f.collectDept : ""} department.${details}${waLink(ownerMobile)}`));
  }
}

async function runMatchingForComplaint(complaintId) {
  const d = DEMO ? loadDemo() : null;
  const complaint = DEMO ? d.complaints.find((c) => c.id === complaintId) : (await DB.listMyComplaints(currentUser.uid)).find((c) => c.id === complaintId);
  if (!complaint) return;
  const cPriv = await DB.getPrivate("complaint", complaintId, currentUser.uid);
  const found = await DB.listFoundPublic();
  for (const f of found) {
    if (f.status === "Delivered to Owner") continue;
    const fPriv = DEMO ? d.foundPrivate[f.id] : null; // demo: match on owner's own data only via complaint desc vs public name/category + complaint desc vs found desc is not available to owner in Supabase; in Supabase mode matching uses the complaint description against item name/category only, plus the pick from the list.
    const fakeFound = { ...f, _desc: fPriv ? fPriv.description : f.itemName };
    const fakeComplaint = { ...complaint, _desc: cPriv ? cPriv.description : complaint.itemName };
    if (!isPossibleMatch(fakeFound, fakeComplaint)) continue;
    const existing = (await DB.listAllMatches()).find((m) => m.complaintId === complaintId && m.foundItemId === f.id && m.status !== "Rejected");
    if (existing) continue;
    await DB.addMatch({ complaintId, foundItemId: f.id, ownerUid: complaint.ownerUid, ownerUsn: complaint.ownerUsn, finderUid: f.uploaderUid, finderUsn: f.finderUsn, status: "Possible Match", createdAt: Date.now() });
    await DB.updateComplaint(complaintId, { matchStatus: "Possible Match" });
  }
}
async function runMatchingForFound(foundId) {
  const found = (await DB.listFoundPublic()).find((x) => x.id === foundId);
  if (!found) return;
  const complaints = DEMO ? loadDemo().complaints : [];
  // In Supabase mode, other users' complaint descriptions stay private;
  // matching for a new upload therefore runs from the complaint side
  // (runMatchingForComplaint) and from the pick in Prompt 3.
  for (const c of complaints) {
    if (c.matchStatus === "Possible Match" || c.matchStatus === "Confirmed") continue;
    const cPriv = await DB.getPrivate("complaint", c.id, c.ownerUid);
    const fPriv = DEMO ? loadDemo().foundPrivate[foundId] : null;
    if (!isPossibleMatch({ ...found, _desc: fPriv ? fPriv.description : found.itemName }, { ...c, _desc: cPriv ? cPriv.description : c.itemName })) continue;
    await DB.addMatch({ complaintId: c.id, foundItemId: found.id, ownerUid: c.ownerUid, ownerUsn: c.ownerUsn, finderUid: found.uploaderUid, finderUsn: found.finderUsn, status: "Possible Match", createdAt: Date.now() });
    await DB.updateComplaint(c.id, { matchStatus: "Possible Match" });
  }
}

/* ---------- UI helpers ---------- */
const $ = (id) => document.getElementById(id);
const views = ["welcome","login","home","upload","complaint","matches","profile"];
// Feedback is compulsory: after an item is delivered, its owner must fill the
// feedback form before using the rest of the app. Checked at login and after
// every delivery / feedback submit; showView enforces it.
async function refreshFeedbackDue() {
  if (!currentUser) { feedbackDue = false; return; }
  try {
    const matches = await DB.listMatches(currentUser.uid);
    const feedback = await DB.listFeedback();
    const found = await DB.listFoundPublic();
    feedbackDue = matches.some((m) => {
      if (m.ownerUid !== currentUser.uid || m.status !== "Confirmed") return false;
      const f = found.find((x) => x.id === m.foundItemId);
      if (!f || f.status !== "Delivered to Owner") return false; // only after delivery, not while waiting for the HOD or the handover
      return !feedback.some((x) => x.foundItemId === m.foundItemId && x.authorUid === currentUser.uid);
    });
  } catch (e) { feedbackDue = false; }
}

function showView(name) {
  // Nothing works until the user is logged in — no demo logins, no guest access.
  if (!currentUser && name !== "welcome" && name !== "login") name = "welcome";
  if (currentUser?.role === "hod" && name === "complaint") name = "home"; // HODs post found items; they never raise complaints
  // Mobile is compulsory — a user without a saved mobile number stays on Profile until they add one.
  if (currentUser && !currentUser.mobile && name !== "profile") name = "profile";
  // Feedback is compulsory — an owner with a delivered item and no feedback stays on Matches until they fill it in.
  if (feedbackDue && name !== "matches") name = "matches";
  views.forEach((v) => $("view-" + v).classList.toggle("active", v === name));
  document.querySelectorAll("#bottomNav button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  window.scrollTo(0, 0);
  if (name === "upload" && currentUser?.role === "hod") {
    // HOD uploads as the department, not as a student.
    $("upFinder").value = "HOD, " + currentUser.department + " Dept";
    $("upUploader").value = "HOD, " + currentUser.department + " Dept";
    $("upFinderUsn").value = currentUser.usn;
    $("upDept").value = HOD_COLLECT_DEPT[currentUser.branchCode] || currentUser.department;
  }
  if (name === "home") renderHome();
  if (name === "matches") renderMatches();
  if (name === "profile") renderProfile();
  if (name === "complaint") renderComplaintPage();
}
function setErr(id, msg) { const el = $(id); if (el) el.textContent = msg || ""; }
function renderHeader() {
  const logged = !!currentUser;
  $("topbarRight").hidden = !logged;
  $("bottomNav").hidden = !logged;
  document.body.classList.toggle("has-nav", logged);
  // HODs never raise complaints — hide the Lost tab for them.
  const lostBtn = document.querySelector('#bottomNav button[data-view="complaint"]');
  if (lostBtn) lostBtn.hidden = logged && currentUser?.role === "hod";
  // On the Welcome screen, a signed-in user sees a welcome-back card,
  // never the Login / Create Account buttons again.
  const wa = $("welcomeAuth"), wb = $("welcomeBack");
  if (wa) wa.hidden = logged;
  if (wb) {
    wb.hidden = !logged;
    if (logged) {
      $("welcomeBackName").textContent = currentUser.name || "Student";
      $("welcomeBackUsn").textContent = currentUser.usn || "";
    }
  }
  if (logged) {
    $("headerUsn").textContent = currentUser.usn + " • " + currentUser.department;
    const av = $("headerAvatar");
    av.textContent = (currentUser.name || currentUser.usn).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }
}
function itemCard(f, showClaim, nComplaints) {
  const photo = f.photoUrl ? `<img class="item-photo" src="${esc(f.photoUrl)}" alt="${esc(f.itemName)}">` : `<div class="photo-placeholder">📦 ${esc(f.category)} — no photo</div>`;
  const badge = f.status === "Delivered to Owner" ? `<span class="badge badge-delivered">✓ Delivered to Owner</span>` : `<span class="badge badge-pending">Pending</span>`;
  const complaintsLine = nComplaints
    ? `<p class="note">💬 ${nComplaints} complaint${nComplaints === 1 ? "" : "s"} raised for this item</p>`
    : `<p class="note">No complaints raised for this item yet.</p>`;
  return `<div class="card">${photo}<p class="item-title" style="margin-top:8px">${esc(f.itemName)}</p>
    <p class="item-meta">${esc(f.category)} • Found at ${esc(f.placeFound)} • ${esc(f.dateFound || "")}</p>
    <p>${badge} <span class="note">Collect from: ${esc(f.collectDept || "")} department</span></p>
    ${complaintsLine}
    <p class="note">Details are shown only to the verified owner.</p>
    ${showClaim ? `<button class="btn btn-secondary btn-small" onclick="window.__goComplaint('${f.id}')">This is mine — Raise a Complaint</button>` : ""}</div>`;
}

/* ---------- Renderers ---------- */
let homeCache = null; // last fetched board data — search filters from this, no refetch per keystroke
function renderHomeList() {
  // Instant, local-only render from the cache: no "Loading…" flash, no network, no shake while typing.
  if (!homeCache) { renderHome(); return; }
  document.querySelectorAll("#categoryChips .chip").forEach((b) => b.classList.toggle("active", b.dataset.cat === activeCategory));
  const { items, complaintCounts, matchedItemIds, delivered } = homeCache;
  const active = items.filter((x) => x.status !== "Delivered to Owner" && !matchedItemIds.has(x.id));
  const filtered = active.filter((x) => (activeCategory === "All" || x.category === activeCategory) && (!searchText || x.itemName.toLowerCase().includes(searchText.toLowerCase())));
  $("foundList").innerHTML = filtered.length ? filtered.map((f) => itemCard(f, true, complaintCounts[f.id] || 0)).join("") :
    `<div class="card"><p>No found items match yet.</p><button class="btn btn-primary btn-small" onclick="document.getElementById('goUploadBtn').click()">Upload Found Item</button></div>`;
  $("deliveredList").innerHTML = delivered.length ? delivered.map((f) => itemCard(f, false, complaintCounts[f.id] || 0)).join("") : "<p class='muted'>No delivered items yet.</p>";
}
async function renderHome() {
  const list = $("foundList"); list.innerHTML = "<p class='muted'>Loading…</p>";
  const chips = $("categoryChips");
  chips.innerHTML = ["All", ...CATEGORIES].map((c) => `<button type="button" class="chip ${activeCategory === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  chips.querySelectorAll(".chip").forEach((b) => b.onclick = () => { activeCategory = b.dataset.cat; renderHomeList(); });
  let items = await DB.listFoundPublic();
  const delivered = items.filter((x) => x.status === "Delivered to Owner");
  // Live hero stats on the Welcome screen (guarded: the hero exists on Welcome only).
  const setStat = (id, n) => { const el = $(id); if (el) el.textContent = String(n); };
  // How many complaints were raised for each found item: a complaint that
  // picked this item when raising, or one the matching engine linked to it.
  // (Counted once per complaint — never twice for the same complaint.)
  let complaintCounts = {};
  // A matched item leaves the public board — it shows only in that owner's
  // Profile and Matches, and nobody else can see anything about it.
  let matchedItemIds = new Set();
  try {
    const allComplaints = await DB.listAllComplaints();
    const allMatches = await DB.listAllMatches();
    setStat("heroStatFound", items.length);
    setStat("heroStatLost", allComplaints.length);
    setStat("heroStatMatches", allMatches.length);
    setStat("heroStatReturned", delivered.length);
    complaintCounts = {};
    allComplaints.forEach((c) => { if (c.foundItemId) complaintCounts[c.foundItemId] = (complaintCounts[c.foundItemId] || 0) + 1; });
    allMatches.forEach((m) => { const c = allComplaints.find((x) => x.id === m.complaintId); if (c && !c.foundItemId) complaintCounts[m.foundItemId] = (complaintCounts[m.foundItemId] || 0) + 1; });
    matchedItemIds = new Set(allMatches.filter((m) => m.status !== "Rejected").map((m) => m.foundItemId));
  } catch (e) { console.warn("Hero stats failed to load:", e); }
  homeCache = { items, complaintCounts, matchedItemIds, delivered };
  renderHomeList();
}
async function renderComplaintPage() {
  const items = await DB.listFoundPublic();
  // Matched items are not pickable — they show only in their owner's Profile.
  let matchedItemIds = new Set();
  try { const allMatches = await DB.listAllMatches(); matchedItemIds = new Set(allMatches.filter((m) => m.status !== "Rejected").map((m) => m.foundItemId)); } catch (e) {}
  const pick = $("cpPickItem");
  pick.innerHTML = items.filter((x) => x.status !== "Delivered to Owner" && !matchedItemIds.has(x.id)).map((x) => `<option value="${x.id}">${esc(x.itemName)} — ${esc(x.placeFound)}</option>`).join("");
  $("cpUsn").value = currentUser ? currentUser.usn : "";
  const mine = currentUser ? await DB.listMyComplaints(currentUser.uid) : [];
  $("myComplaints").innerHTML = mine.length ? mine.map((c) => `<div class="card"><p class="item-title">${esc(c.itemName)}</p><p class="item-meta">${esc(c.category)} • ${esc(c.date || "")}</p><p><span class="badge badge-match">${esc(c.matchStatus || "Waiting for Match")}</span> <span class="badge ${c.itemStatus === "Delivered to Owner" ? "badge-delivered" : "badge-pending"}">${esc(c.itemStatus || "Pending")}</span></p></div>`).join("") :
    `<div class="card"><p class="muted">No complaints yet. Raise one above.</p></div>`;
}
async function renderMatches() {
  const wrap = $("matchesList"); wrap.innerHTML = "<p class='muted'>Loading…</p>";
  const matches = currentUser ? await DB.listMatches(currentUser.uid) : [];
  const found = await DB.listFoundPublic();
  const feedback = await DB.listFeedback();
  // Re-check the compulsory-feedback flag with the data already loaded.
  feedbackDue = matches.some((m) => {
    if (m.ownerUid !== currentUser.uid || m.status !== "Confirmed") return false;
    const f = found.find((x) => x.id === m.foundItemId);
    if (!f || f.status !== "Delivered to Owner") return false;
    return !feedback.some((x) => x.foundItemId === m.foundItemId && x.authorUid === currentUser.uid);
  });
  if (!matches.length) { wrap.innerHTML = `<div class="card"><p class="muted">No matches yet. Raise a complaint with a detailed description and matching items will appear here.</p></div>`; }
  else {
    wrap.innerHTML = "";
    for (const m of matches) {
      const f = found.find((x) => x.id === m.foundItemId) || { itemName:"(item)", category:"", collectDept:"", status:"Pending" };
      const isOwner = m.ownerUid === currentUser.uid;
      const card = document.createElement("div"); card.className = "card";
      const photo = f.photoUrl ? `<img class="item-photo" src="${esc(f.photoUrl)}" alt="${esc(f.itemName)}">` : `<div class="photo-placeholder">📦 ${esc(f.category)} — no photo</div>`;
      let html = `${photo}<p class="item-title">${esc(f.itemName)}</p><p class="item-meta">${esc(f.category)} • Found at ${esc(f.placeFound || "")} • Collect from: ${esc(f.collectDept || "")} department</p>
        <p><span class="badge badge-match">${esc(m.status)}</span> <span class="badge ${f.status === "Delivered to Owner" ? "badge-delivered" : "badge-pending"}">${esc(f.status)}</span></p>`;
      if (m.status === "Possible Match" && isOwner) {
        html += `<label style="display:block;margin:8px 0"><input type="checkbox" id="confirm-${m.id}"> I confirm this item matches my description and I am its owner.</label>
          <button class="btn btn-primary btn-small" id="yes-${m.id}">Yes, this is my item</button>
          <button class="btn btn-secondary btn-small" id="no-${m.id}">No, this is not mine</button>
          <div class="error" id="err-${m.id}"></div>`;
      }
      if (m.status === "Confirmed") {
        // The other person's details are NEVER shown in the app — only in the
        // confirmation mail on Gmail, after the owner confirms the match.
        html += `<p class="note">Confirmed — each other's details (name, USN, mobile, item info) are in your confirmation mail on Gmail. Please check your inbox.</p>`;
        // WhatsApp: one button that opens a chat with the other person, with both
        // sides' details pre-filled in the message. No details are shown in the app.
        const ownerPriv = await DB.getPrivate("complaint", m.complaintId, currentUser.uid);
        const finderPriv = await DB.getPrivate("found", m.foundItemId, currentUser.uid);
        const ownerMobile = ownerPriv?.mobile || ""; const finderMobile = finderPriv?.mobile || "";
        const ownerProfile = await DB.getProfile(m.ownerUid).catch(() => null);
        const finderProfile = await DB.getProfile(m.finderUid).catch(() => null);
        const ownerName = ownerProfile?.name || m.ownerUsn;
        const finderName = finderProfile?.name || f.finderName || m.finderUsn;
        const otherMobile = isOwner ? finderMobile : ownerMobile;
        if (otherMobile) {
          const waText = `LostLink — NCET: Your item has been matched.\nItem: ${f.itemName} (${f.category}) — found at ${f.placeFound || ""}, collect from ${f.collectDept || ""} department.\nOwner: ${ownerName} (${m.ownerUsn}), mobile ${ownerMobile}\nFinder: ${finderName} (${m.finderUsn}), mobile ${finderMobile}`;
          html += `<a class="btn btn-primary btn-small" target="_blank" rel="noopener" href="https://wa.me/91${otherMobile}?text=${encodeURIComponent(waText)}">Message on WhatsApp</a>`;
        }
        if (isOwner && f.status !== "Delivered to Owner")
          html += (f.finderUsn || "").startsWith("HOD-")
            ? `<p class="note">Confirmed — waiting for the HOD of the ${esc(f.collectDept || "")} department to accept the handover.</p>`
            : `<button class="btn btn-primary" id="got-${m.id}">I received my item</button>`;
        if (f.status === "Delivered to Owner") html += `<p class="ok">✓ Delivered to Owner</p>` + (isOwner ? feedbackFormHtml(m, f, feedback) : "");
      }
      card.innerHTML = html; wrap.appendChild(card);
      const yes = $("yes-" + m.id), no = $("no-" + m.id);
      if (yes) yes.onclick = async () => {
        if (!$("confirm-" + m.id).checked) { setErr("err-" + m.id, "Please tick the confirmation line first."); return; }
        await confirmMatch(m, f);
        renderMatches(); renderHome();
      };
      if (no) no.onclick = async () => { await DB.updateMatch(m.id, { status: "Rejected" }); await DB.updateComplaint(m.complaintId, { matchStatus: "Waiting for Match" }); renderMatches(); };
      const got = $("got-" + m.id);
      if (got) got.onclick = async () => {
        await DB.updateFound(m.foundItemId, { status: "Delivered to Owner" });
        await DB.updateComplaint(m.complaintId, { itemStatus: "Delivered to Owner", matchStatus: "Confirmed" });
        await DB.updateMatch(m.id, { status: "Confirmed" });
        sendMail(usnToEmail(m.finderUsn), "LostLink: your found item reached its owner",
          mailWrap("Delivered to Owner", `Good news — the owner has received the <b>${f ? f.itemName : "item"}</b> you found. Thank you for returning it!`));
        await refreshFeedbackDue();
        renderMatches(); renderHome();
      };
      const fbForm = card.querySelector("[data-feedback-form]");
      if (fbForm) fbForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const rating = Number(fbForm.querySelector("[name=rating]:checked")?.value || 0);
        if (!rating) { fbForm.querySelector(".error").textContent = "Please give a rating."; return; }
        await DB.submitFeedback({ foundItemId: m.foundItemId, authorUid: currentUser.uid, usn: currentUser.usn, rating,
          returnedSafely: fbForm.returned.value, collection: fbForm.collection.value, message: fbForm.message.value, date: today() });
        await refreshFeedbackDue();
        renderMatches(); renderFeedbackList();
      });
    }
  }
  renderFeedbackList();
}
function feedbackFormHtml(m, f, feedback) {
  const done = feedback.some((x) => x.foundItemId === m.foundItemId && x.authorUid === currentUser.uid);
  if (done) return `<p class="ok">Thank you for your feedback.</p>`;
  return `<form data-feedback-form><h3>Give Feedback — compulsory</h3>
    <p class="note">Please fill this in to finish — feedback is compulsory after delivery.</p>
    <div>${[1,2,3,4,5].map((n) => `<label><input type="radio" name="rating" value="${n}"> ${"★".repeat(n)}</label>`).join(" ")}</div>
    <div class="field"><label>Was the item returned safely?</label><select name="returned"><option>Yes</option><option>No</option></select></div>
    <div class="field"><label>How was the collection from the department?</label><select name="collection"><option>Easy</option><option>Okay</option><option>Difficult</option></select></div>
    <div class="field"><label>Feedback message</label><textarea name="message" placeholder="Tell us what worked or what we should improve"></textarea></div>
    <p class="muted">Your USN: ${esc(currentUser.usn)}</p>
    <button class="btn btn-primary btn-small" type="submit">Submit Feedback</button><div class="error"></div></form>`;
}
async function renderFeedbackList() {
  const items = await DB.listFeedback();
  const found = await DB.listFoundPublic();
  $("feedbackList").innerHTML = items.length ? items.map((x) => { const f = found.find((y) => y.id === x.foundItemId); return `<div class="card"><p>${"★".repeat(x.rating)}${"☆".repeat(5 - x.rating)} — ${esc(f ? f.itemName : "Item")}</p><p class="muted">${esc(x.message || "")} • ${esc(x.usn)}</p></div>`; }).join("") : "<p class='muted'>No feedback yet.</p>";
}
async function renderProfile() {
  if (!currentUser) return;
  const u = currentUser;
  $("profileAvatar").textContent = (u.name || u.usn).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  $("profileName").textContent = u.name || "Not added yet — tap Edit Profile";
  $("profileSub").textContent = `${u.usn} • ${u.department} (${u.branchCode.toUpperCase()})`;
  // The edit form opens by itself when the mobile is missing (compulsory),
  // otherwise it stays behind the Edit Profile button.
  $("profileForm").hidden = !!u.mobile;
  $("editProfileToggle").textContent = $("profileForm").hidden ? "Edit Profile" : "Close";
  $("profileDetails").innerHTML = u.role === "hod"
    ? `<p><b>Role:</b> HOD — ${esc(u.department)} Department</p><p><b>Department email:</b> ${esc(u.email)}</p><p><b>Mobile:</b> ${esc(u.mobile || "Not added yet — tap Edit Profile")}</p><p class="note">Workers hand found items to the department — post them from Upload, and accept or reject claims below.</p>`
    : `<p><b>USN:</b> ${esc(u.usn)}</p><p><b>College email:</b> ${esc(u.email)}</p><p><b>Department:</b> ${esc(u.department)} (${esc(u.branchCode.toUpperCase())})</p><p><b>Year of admission:</b> 20${esc(u.year)}</p><p><b>Mobile:</b> ${esc(u.mobile || "Not added yet — tap Edit Profile")}</p><p class="note">Mobile is visible only to you.</p>`;
  $("pfName").value = u.name || ""; $("pfMobile").value = u.mobile || "";
  const found = await DB.listFoundPublic();
  const mine = found.filter((x) => x.uploaderUid === u.uid);
  const complaints = await DB.listMyComplaints(u.uid);
  const delivered = mine.filter((x) => x.status === "Delivered to Owner").length + complaints.filter((c) => c.itemStatus === "Delivered to Owner").length;
  $("countFound").textContent = mine.length; $("countLost").textContent = complaints.length; $("countDelivered").textContent = delivered;
  // My Complaints (student only): the owner can also accept a match from their
  // own Profile — with the matched item's photo, so they can check it first.
  const myBox = $("myComplaintsBox");
  if (myBox) {
    if (u.role === "hod") { myBox.hidden = true; myBox.innerHTML = ""; }
    else {
      const allMatches = await DB.listAllMatches();
      myBox.hidden = false;
      myBox.innerHTML = `<h3>My Complaints</h3>` + (complaints.length ? complaints.map((c) => {
        const m = allMatches.find((x) => x.complaintId === c.id && x.status === "Possible Match");
        const f = m ? found.find((x) => x.id === m.foundItemId) : null;
        return `<div class="card" style="margin-top:10px"><p class="item-title">${esc(c.itemName)}</p><p class="item-meta">${esc(c.category)} • ${esc(c.matchStatus)} • ${esc(c.itemStatus)}</p>${f ? `<p>${f.photoUrl ? `<img class="item-photo" src="${esc(f.photoUrl)}" alt="${esc(f.itemName || "")}">` : ""}</p><p class="item-meta">Possible match: ${esc(f.itemName)} — found at ${esc(f.placeFound || "")}, collect from ${esc(f.collectDept || "")}</p><p><button class="btn btn-primary btn-small" data-accept-complaint="${m.id}">Accept — yes, this is my item</button></p>` : ""}</div>`;
      }).join("") : `<p class="muted">No complaints yet.</p>`);
      myBox.querySelectorAll("[data-accept-complaint]").forEach((b) => b.onclick = async () => {
        const m = allMatches.find((x) => x.id === b.dataset.acceptComplaint);
        const f = found.find((x) => x.id === m.foundItemId) || {};
        await confirmMatch(m, f);
        await refreshFeedbackDue();
        renderProfile(); renderHome();
      });
    }
  }
  // HOD approvals: claims the owner already confirmed for this department's
  // items. The HOD accepts (→ Delivered to Owner) or rejects (→ matching again).
  const hodBox = $("hodApprovals");
  if (hodBox) {
    if (u.role !== "hod") { hodBox.hidden = true; hodBox.innerHTML = ""; }
    else {
      hodBox.hidden = false;
      const allMatches = await DB.listAllMatches();
      const pending = allMatches.filter((m) => m.status === "Confirmed" && m.finderUid === u.uid && (found.find((x) => x.id === m.foundItemId)?.status !== "Delivered to Owner"));
      hodBox.innerHTML = `<h3>Claims waiting for your approval</h3>` + (pending.length ? pending.map((m) => {
        const f = found.find((x) => x.id === m.foundItemId) || {};
        return `<div class="card" style="margin-top:10px"><p class="item-title">${esc(f.itemName || "Item")}</p><p class="item-meta">${esc(f.category || "")} • Claimed by ${esc(m.ownerUsn)} • Found at ${esc(f.placeFound || "")}</p>${f.photoUrl ? `<img class="item-photo" src="${esc(f.photoUrl)}" alt="${esc(f.itemName || "")}">` : ""}<p><button class="btn btn-primary btn-small" data-hod-accept="${m.id}">Accept — hand it over</button> <button class="btn btn-secondary btn-small" data-hod-reject="${m.id}">Reject</button></p></div>`;
      }).join("") : `<p class="muted">No claims waiting for approval.</p>`);
      hodBox.querySelectorAll("[data-hod-accept]").forEach((b) => b.onclick = async () => {
        const m = pending.find((x) => x.id === b.dataset.hodAccept);
        const f = found.find((x) => x.id === m.foundItemId) || {};
        await DB.updateFound(m.foundItemId, { status: "Delivered to Owner" });
        await DB.updateComplaint(m.complaintId, { itemStatus: "Delivered to Owner", matchStatus: "Confirmed" });
        sendMail(usnToEmail(m.ownerUsn), "LostLink: HOD accepted — your item is delivered",
          mailWrap("Delivered to Owner", `The HOD of the ${esc(f.collectDept || "")} department accepted your claim for <b>${esc(f.itemName || "your item")}</b>. It is now marked <b>Delivered to Owner</b> — please collect it from the department.`));
        renderProfile(); renderHome();
      });
      hodBox.querySelectorAll("[data-hod-reject]").forEach((b) => b.onclick = async () => {
        const m = pending.find((x) => x.id === b.dataset.hodReject);
        const f = found.find((x) => x.id === m.foundItemId) || {};
        await DB.updateMatch(m.id, { status: "Rejected" });
        await DB.updateComplaint(m.complaintId, { matchStatus: "Waiting for Match" });
        sendMail(usnToEmail(m.ownerUsn), "LostLink: your claim was not accepted",
          mailWrap("Claim not accepted", `The HOD did not accept your claim for <b>${esc(f.itemName || "the item")}</b>. Your complaint is open again and matching continues.`));
        renderProfile(); renderHome();
      });
    }
  }
}

/* ---------- Auth / session ---------- */
async function setSession(user) {
  currentUser = user;
  if (DEMO) localStorage.setItem("lostlink_session", JSON.stringify({ uid: user.uid }));
  await refreshFeedbackDue();
  renderHeader(); showView("home");
}
// Validate a Supabase auth user: USN ncetmail only, profile row created on first login.
async function handleSupabaseUser(authUser) {
  const email = (authUser.email || "").trim().toLowerCase();
  const usn = email.split("@")[0].toUpperCase();
  // HOD login: hod-<branch>@ncetmail.com — no USN rule, department from the email.
  const hod = hodFromEmail(email);
  if (hod) {
    let profile = await DB.getProfile(authUser.id);
    if (!profile) {
      const row = { id: authUser.id, email: hod.email, usn: hod.usn, department: hod.department, branch_code: hod.branchCode, year: "", name: "HOD — " + hod.department, mobile: "" };
      const { error } = await supabase.from("users").insert(row);
      profile = error ? mapProfile(row) : (await DB.getProfile(authUser.id)) || mapProfile(row);
    }
    if (profile) { currentUser = profile; renderHeader(); showView("home"); }
    else showView("welcome");
    return;
  }
  const v = validateCollegeEmailAndUsn(email, usn);
  if (!v.ok) {
    await supabase.auth.signOut();
    currentUser = null; renderHeader(); showView("welcome");
    setErr("errGoogle", v.error);
    return;
  }
  let profile = await DB.getProfile(authUser.id);
  if (!profile) {
    const meta = authUser.user_metadata || {};
    const row = { id: authUser.id, email, usn, department: v.department, branch_code: v.branchCode, year: v.year, name: meta.full_name || meta.name || "", mobile: "" };
    const { error } = await supabase.from("users").insert(row);
    profile = error ? mapProfile(row) : (await DB.getProfile(authUser.id)) || mapProfile(row);
  }
  if (profile) { currentUser = profile; renderHeader(); showView("home"); }
  else showView("welcome");
}
let sessionRestored = false;
async function restoreSession() {
  if (DEMO) {
    const raw = localStorage.getItem("lostlink_session");
    if (raw) { try { const p = await DB.getProfile(JSON.parse(raw).uid); if (p) { currentUser = p; renderHeader(); showView("home"); return; } } catch (e) {} }
    showView("welcome");
    return;
  }
  // Stay signed in: check the saved session FIRST, before deciding what to show.
  // The old code only listened for auth events, so a returning user could land
  // on the login screen even though a valid session was stored on this device.
  $("loading").hidden = false;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) { sessionRestored = true; await handleSupabaseUser(data.session.user); }
  } catch (e) {}
  // Listener only for what happens AFTER this load (sign-in / sign-out in this
  // or another tab). The initial event is ignored when the check above already
  // restored the session, so the home screen is not re-rendered.
  supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user || null;
    if (event === "SIGNED_OUT" || !user) { sessionRestored = false; currentUser = null; renderHeader(); showView("welcome"); return; }
    if (event === "INITIAL_SESSION" && sessionRestored) return;
    sessionRestored = true;
    await handleSupabaseUser(user);
  });
  $("loading").hidden = true;
  if (!currentUser) showView("welcome");
}
async function logout() {
  if (!DEMO) { try { await supabase.auth.signOut(); } catch (e) {} }
  localStorage.removeItem("lostlink_session");
  currentUser = null; renderHeader(); showView("welcome");
}

/* ---------- Wire up ---------- */
function fillSelects() {
  $("upCategory").innerHTML = CATEGORIES.map((c) => `<option>${c}</option>`).join("");
  $("cpCategory").innerHTML = CATEGORIES.map((c) => `<option>${c}</option>`).join("");
  $("upDept").innerHTML = COLLECT_DEPTS.map((d) => `<option>${d}</option>`).join("");
}
window.__goView = (name) => showView(name);
window.__goComplaint = (foundId) => { showView("complaint"); $("cpFoundYesNo").value = "Yes"; $("cpPickWrap").hidden = false; const p = $("cpPickItem"); if ([...p.options].some((o) => o.value === foundId)) p.value = foundId; };

async function boot() {
  const banner = $("modeBanner");
  if (DEMO) {
    banner.hidden = false;
    banner.textContent = "Demo Mode — Supabase not connected yet. Dummy data only. Paste your Supabase URL and anon key in supabase.js to go live.";
  } else { banner.hidden = true; }
  fillSelects();
  $("welcomeLoginBtn").onclick = () => { $("loginTitle").textContent = "Login with College Email"; showView("login"); };
  // Student / HOD login toggle — students sign in only with Gmail, HODs with a password.
  let loginRole = "student";
  const setLoginRole = (role) => {
    loginRole = role;
    $("roleStudentBtn").classList.toggle("active", role === "student");
    $("roleHodBtn").classList.toggle("active", role === "hod");
    $("studentLoginBlock").hidden = role !== "student";
    $("hodLoginFields").hidden = role !== "hod";
    $("loginTitle").textContent = role === "hod" ? "HOD Login" : "Login with College Email";
  };
  $("roleStudentBtn").onclick = () => setLoginRole("student");
  $("roleHodBtn").onclick = () => setLoginRole("hod");
  $("hodLoginBtn").onclick = async () => {
    setErr("errHodLogin", ""); setErr("errHodPassword", "");
    const code = $("hodDept").value; const pw = $("hodPassword").value;
    if (!pw || pw.length < 6) { setErr("errHodPassword", "Password is required, minimum 6 characters."); return; }
    try {
      const user = await DB.signIn("hod-" + code + "@ncetmail.com", "HOD-" + code.toUpperCase(), pw);
      await setSession(user);
    } catch (err) { setErr("errHodLogin", err.message || "HOD login failed. Please try again."); }
  };
  $("welcomeHomeBtn").onclick = () => showView("home");
  $("welcomeUploadBtn").onclick = () => showView("upload");
  $("logoutBtn").onclick = logout; $("profileLogoutBtn").onclick = logout;
  $("headerAvatar").onclick = (e) => { e.preventDefault(); showView("profile"); };
  $("goUploadBtn").onclick = () => showView("upload");
  $("goComplaintBtn").onclick = () => showView("complaint");
  $("searchBox").addEventListener("input", (e) => { searchText = e.target.value; renderHomeList(); }); // local filter only — no refetch, no shake
  // USN fields: no input handler needed — the fields already show uppercase via
  // text-transform, and both submit handlers read the value with .toUpperCase().
  // (Rewriting the value on every keystroke used to jump the cursor to the end.)
  $("upCategory").addEventListener("change", (e) => { $("upOthersWrap").hidden = e.target.value !== "Others"; });
  $("cpCategory").addEventListener("change", (e) => { $("cpOthersWrap").hidden = e.target.value !== "Others"; });
  $("cpFoundYesNo").addEventListener("change", (e) => { $("cpPickWrap").hidden = e.target.value !== "Yes"; });
  // Photo: Take Photo opens the camera, Upload Photo opens the gallery/files.
  const setPhoto = (f) => {
    selectedPhoto = f || null;
    $("upPhotoPreview").innerHTML = f
      ? `<img class="item-photo" src="${URL.createObjectURL(f)}" alt="Selected photo" style="max-width:220px"><p class="muted">Selected: ${esc(f.name)}</p><p><button class="link-btn" type="button" id="removePhotoBtn">Remove photo</button></p>`
      : "";
    const rm = $("removePhotoBtn");
    if (rm) rm.onclick = () => { selectedPhoto = null; $("upPhoto").value = ""; $("upPhotoCamera").value = ""; $("upPhotoPreview").innerHTML = ""; };
  };
  $("takePhotoBtn").onclick = () => $("upPhotoCamera").click();
  $("uploadPhotoBtn").onclick = () => $("upPhoto").click();
  $("upPhoto").addEventListener("change", (e) => setPhoto(e.target.files[0] || null));
  $("upPhotoCamera").addEventListener("change", (e) => setPhoto(e.target.files[0] || null));

  const doGoogleLogin = async () => {
    setErr("errGoogle", "");
    try {
      const res = await DB.signInWithGoogle();
      if (!res) return; // Google OAuth redirects away; restoreSession handles the return
      await setSession(res);
    } catch (err) { setErr("errGoogle", err.message || "Google sign-in failed. Please try again."); }
  };
  $("googleLoginBtn").onclick = doGoogleLogin;

  $("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault(); setErr("errUpload",""); $("okUpload").textContent = "";
    const g = (id) => $(id).value.trim();
    let ok = true;
    // HOD uploads as the department — no student finder name/USN/mobile needed.
    const isHod = currentUser?.role === "hod";
    const need = isHod
      ? [["upItemName","errUpItemName","Item name is required."],["upPlace","errUpPlace","Place is required."],["upDesc","errUpDesc","Description is required."]]
      : [["upUploader","errUpUploader","Uploader name is required."],["upFinder","errUpFinder","Finder name is required."],["upItemName","errUpItemName","Item name is required."],["upPlace","errUpPlace","Place is required."],["upDesc","errUpDesc","Description is required."]];
    need.forEach(([f, err, msg]) => { setErr(err, ""); if (!g(f)) { setErr(err, msg); ok = false; } });
    const finderUsn = isHod ? currentUser.usn : g("upFinderUsn").toUpperCase();
    if (!isHod) {
      if (!isMobile(g("upMobile"))) { setErr("errUpMobile", "Mobile number must be exactly 10 digits."); ok = false; } else setErr("errUpMobile","");
      if (!/^1NC[0-9]{2}(CS|IS|CD|CI|EC|CV|IC)[0-9]{3}$/.test(finderUsn)) { setErr("errUpFinderUsn", "Enter a valid USN, e.g. 1NC24CS146."); ok = false; } else setErr("errUpFinderUsn","");
    } else { setErr("errUpMobile",""); setErr("errUpFinderUsn",""); }
    const cat = $("upCategory").value; const itemName = cat === "Others" ? g("upOthersName") : g("upItemName");
    if (cat === "Others" && !itemName) { setErr("errUpCategory", "Type the item name for Others."); ok = false; }
    if (!ok) return;
    const photoFile = selectedPhoto || $("upPhoto").files[0] || $("upPhotoCamera").files[0] || null;
    const id = await DB.createFound(
      { itemName, category: cat, placeFound: g("upPlace"), collectDept: isHod ? (HOD_COLLECT_DEPT[currentUser.branchCode] || currentUser.department) : $("upDept").value, status: "Pending", finderUsn, finderName: isHod ? "HOD, " + currentUser.department + " Dept" : g("upFinder"), uploaderName: isHod ? "HOD, " + currentUser.department + " Dept" : g("upUploader"), uploaderUid: currentUser.uid, photoUrl: "" },
      { mobile: isHod ? (currentUser.mobile || "") : g("upMobile"), description: g("upDesc") }, photoFile);
    await runMatchingForFound(id);
    $("okUpload").textContent = "Item uploaded successfully.";
    e.target.reset(); $("upOthersWrap").hidden = true; selectedPhoto = null; $("upPhotoPreview").innerHTML = "";
    setTimeout(() => showView("home"), 600);
  });

  $("complaintForm").addEventListener("submit", async (e) => {
    e.preventDefault(); setErr("errComplaint",""); $("okComplaint").textContent = "";
    const g = (id) => $(id).value.trim();
    let ok = true;
    if (!g("cpItemName")) { setErr("errCpItemName", "Item name is required."); ok = false; } else setErr("errCpItemName","");
    if (!isMobile(g("cpMobile"))) { setErr("errCpMobile", "Mobile number must be exactly 10 digits."); ok = false; } else setErr("errCpMobile","");
    if (!g("cpDesc")) { setErr("errCpDesc", "Description is required — matching needs it."); ok = false; } else setErr("errCpDesc","");
    if (!ok) return;
    const cat = $("cpCategory").value; const itemName = cat === "Others" ? g("cpOthersName") : g("cpItemName");
    const foundId = $("cpFoundYesNo").value === "Yes" ? $("cpPickItem").value : null;
    // One open complaint per item: if the owner already has a complaint for this
    // same item that is not delivered yet, block the duplicate and point them
    // at their Matches. A delivered complaint does not block a new one.
    const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const mine = await DB.listMyComplaints(currentUser.uid);
    const dup = mine.find((c) => c.itemStatus !== "Delivered to Owner" && ((foundId && c.foundItemId === foundId) || (!foundId && norm(c.itemName) === norm(itemName) && c.category === cat)));
    if (dup) { setErr("errComplaint", `You already raised a complaint for "${dup.itemName}". Check My Matches — you cannot raise another one for the same item while it is still open.`); return; }
    const id = await DB.createComplaint(
      { itemName, category: cat, ownerUsn: g("cpUsn").toUpperCase() || currentUser.usn, ownerUid: currentUser.uid, foundItemId: foundId, matchStatus: "Waiting for Match", itemStatus: "Pending" },
      { mobile: g("cpMobile"), description: g("cpDesc") });
    // If the owner picked a found item, create a Possible Match directly.
    if (foundId) {
      const f = (await DB.listFoundPublic()).find((x) => x.id === foundId);
      if (f && f.category === cat) {
        await DB.addMatch({ complaintId: id, foundItemId: foundId, ownerUid: currentUser.uid, ownerUsn: currentUser.usn, finderUid: f.uploaderUid, finderUsn: f.finderUsn, status: "Possible Match", createdAt: Date.now() });
        await DB.updateComplaint(id, { matchStatus: "Possible Match" });
      }
    }
    await runMatchingForComplaint(id);
    // Email 1: complaint raised — the owner gets a mail right away.
    sendMail(currentUser.email || usnToEmail(currentUser.usn), "LostLink: complaint raised for " + itemName,
      mailWrap("Complaint raised", `Your complaint for <b>${itemName}</b> (${cat}) has been raised on LostLink. We will mail you again the moment a found item matches it.`));
    // Email 2: if a Possible Match already exists, mail both sides now.
    try {
      const mine = await DB.listMyComplaints(currentUser.uid);
      const c = mine.find((x) => x.id === id);
      if (c && c.matchStatus === "Possible Match") {
        const all = await DB.listAllMatches();
        const m = all.find((x) => x.complaintId === id && x.status === "Possible Match");
        if (m) {
          sendMail(currentUser.email || usnToEmail(currentUser.usn), "LostLink: possible match for " + itemName,
            mailWrap("Possible match found!", `A found item may be your <b>${itemName}</b>. Open LostLink &gt; Matches to check it and confirm — the finder has been mailed too.`));
          sendMail(usnToEmail(m.finderUsn), "LostLink: someone may own the item you found",
            mailWrap("Possible match for your found item", `A student raised a complaint that may match the <b>${itemName}</b> you found. Open LostLink &gt; Matches to confirm.`));
        }
      }
    } catch (e) {}
    $("okComplaint").textContent = "Complaint raised. We will notify you if your item matches a found item.";
    e.target.reset(); renderComplaintPage();
    setTimeout(() => showView("matches"), 600);
  });

  $("editProfileToggle").addEventListener("click", () => {
    const f = $("profileForm"); f.hidden = !f.hidden;
    $("editProfileToggle").textContent = f.hidden ? "Edit Profile" : "Close";
  });
  $("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault(); setErr("errPfName",""); setErr("errPfMobile","");
    const name = $("pfName").value.trim(), mobile = $("pfMobile").value.trim();
    if (!name) { setErr("errPfName", "Full name is required."); return; }
    if (!isMobile(mobile)) { setErr("errPfMobile", "Mobile number must be exactly 10 digits."); return; }
    await DB.updateProfile(currentUser.uid, { name, mobile }); // only name + mobile, never USN/email/dept/year
    currentUser = { ...currentUser, name, mobile };
    $("okProfile").textContent = "Profile updated."; renderHeader(); renderProfile();
  });

  await restoreSession();
}
boot();

