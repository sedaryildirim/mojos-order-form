// ---- Edit this file to update branches / email addresses ----
// No coding needed elsewhere: item list/prices/pars live in data.js.

const CONFIG = {
  branches: [
    { id: "nathon", name: "Mojo's Nathon", email: "mojos.nathon@gmail.com", region: "Koh Samui", suppliers: ["makro-samui", "foodproject", "drinks", "winepro"] },
    { id: "lamai", name: "Mojo's Lamai", email: "mojos.lamai@gmail.com", region: "Koh Samui", suppliers: ["makro-samui", "foodproject", "drinks", "winepro"] },
    { id: "chaloklum", name: "Mojo's Chaloklum", email: "mojos.chaloklum@gmail.com", region: "Koh Phangan", suppliers: ["makro-phangan", "winepro", "phangangreenveg"] },
    { id: "thongsala", name: "Mojo's Thongsala", email: "mojos.thongsala@gmail.com", region: "Koh Phangan", suppliers: ["makro-phangan", "winepro", "phangangreenveg"] },
    { id: "kaifchaloklum", name: "Kaif Chaloklum", email: "amazingphangan.kaif@gmail.com", region: "Koh Phangan", suppliers: ["makro-kaif", "winepro", "phangangreenveg"] }
  ],
  // Each id must match a key in the DATA object in data.js.
  // Full list shown to a branch unless that branch has its own `suppliers` array (list of ids) above.
  // Three separate Makro lists, same chain, different item selection & pricing per branch:
  // makro-samui (Nathon/Lamai), makro-phangan (Chaloklum/Thongsala), makro-kaif (Kaif Chaloklum).
  // phangangreenveg = Koh Phangan-only produce supplier (Chaloklum/Thongsala/Kaif), not offered on Samui.
  suppliers: [
    { id: "makro-samui", name: "Order Makro" },
    { id: "makro-phangan", name: "Order Makro" },
    { id: "makro-kaif", name: "Order Makro" },
    { id: "foodproject", name: "Order Food Project" },
    { id: "drinks", name: "Order Drinks" },
    { id: "winepro", name: "Order Wine Pro" },
    { id: "phangangreenveg", name: "Order Phangan Green Vegetables" }
  ],
  // CC'd on every order email (leave "" to disable)
  ccEmail: ""
};
