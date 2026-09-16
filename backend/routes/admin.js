const express = require("express");
const User = require("../models/User");
const Plan = require("../models/Plan");
const ChatMessage = require("../models/ChatMessage");
const { requireAuth, requireAdmin, requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();

// All admin routes require admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, activeUsers, verifiedUsers, todayUsers, totalPlans, totalMessages, plans, recentUsers] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isVerified: true }),
        User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } }),
        Plan.countDocuments({ active: true }),
        ChatMessage.countDocuments(),
        Plan.find({ active: true }).select("name price users"),
        User.find().sort({ createdAt: -1 }).limit(8).select("name email role isVerified isActive planId createdAt gstNumber businessName"),
      ]);

    const planBreakdown = [];
    for (const p of plans) {
      planBreakdown.push({ name: p.name, count: await User.countDocuments({ planId: p._id }) });
    }

    return res.json({
      totalUsers,
      activeUsers,
      verifiedUsers,
      todayUsers,
      totalPlans,
      totalMessages,
      planBreakdown,
      recentUsers,
    });
  } catch (err) {
    console.error("[admin stats]", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/admin/users  (list users with optional search)
router.get("/users", async (req, res) => {
  try {
    const { search, role = "user" } = req.query;
    const filter = { role: role === "all" ? { $in: ["user", "admin"] } : role };
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { gstNumber: rx }, { businessName: rx }];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).populate("planId", "name price");
    return res.json({ users: users.map((u) => u.toPublic()) });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// PATCH /api/admin/users/:id  (toggle active / suspend)
router.patch("/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (String(req.params.id) === String(req.userId)) {
      return res.status(400).json({ error: "You cannot modify your own account" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (typeof isActive === "boolean") user.isActive = isActive;
    await user.save();
    return res.json({ user: user.toPublic(), message: "User updated" });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// ─── Admin management (super admin only) ────────────────────────────────

// GET /api/admin/admins  -> list all admins
router.get("/admins", requireSuperAdmin, async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ["admin", "superadmin"] } })
      .sort({ createdAt: 1 })
      .select("name username email phone role isActive isVerified createdAt");
    return res.json({ admins: admins.map((a) => a.toPublic()) });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/admin/admins/:id/promote  -> make a user an admin (super admin only)
router.post("/admins/:id/promote", requireSuperAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "superadmin") return res.status(400).json({ error: "Already a super admin" });
    user.role = "admin";
    await user.save();
    return res.json({ message: `${user.name} is now an admin`, user: user.toPublic() });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/admin/admins/:id/demote  -> remove admin (super admin only)
router.post("/admins/:id/demote", requireSuperAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "superadmin") return res.status(400).json({ error: "Cannot demote the super admin" });
    user.role = "user";
    await user.save();
    return res.json({ message: `${user.name} is no longer an admin`, user: user.toPublic() });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/admin/broadcast  -> send a message to the chosen customers (from this admin)
//   body: { content, userIds: [id, ...] }  — send to specific customers
router.post("/broadcast", async (req, res) => {
  try {
    const text = String(req.body.content || "").trim();
    if (!text) return res.status(400).json({ error: "Message is required" });

    const userIds = Array.isArray(req.body.userIds) ? req.body.userIds.map(String) : [];
    const recipients =
      userIds.length > 0
        ? await User.find({ _id: { $in: userIds }, role: "user", isActive: true }).select("_id name")
        : await User.find({ role: "user", isActive: true }).select("_id name");

    if (!recipients.length) return res.status(400).json({ error: "No matching customers found" });

    const messages = recipients.map((u) => ({
      senderId: req.userId,
      senderRole: req.user.role,
      receiverId: u._id,
      content: text,
    }));
    await ChatMessage.insertMany(messages);

    return res.status(201).json({ message: `Message sent to ${recipients.length} customer${recipients.length > 1 ? "s" : ""}`, count: recipients.length });
  } catch (err) {
    console.error("[admin broadcast]", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/admin/handlers  -> which users chat, quick list for messaging
router.get("/handlers", async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("name email avatar businessName online isVerified")
      .sort({ createdAt: -1 });
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;