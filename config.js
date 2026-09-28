// ---- Edit this file to update branches / email addresses ----
// No coding needed elsewhere: item list/prices/pars live in data.js.

const CONFIG = {
  branches: [
    { id: "nathon", name: "Mojo's Nathon", email: "mojos.nathon@gmail.com", region: "Koh Samui", suppliers: ["makro", "foodproject", "drinks", "winepro"] },
    { id: "lamai", name: "Mojo's Lamai", email: "mojos.lamai@gmail.com", region: "Koh Samui", suppliers: ["makro", "foodproject", "drinks", "winepro"] },
    { id: "chaloklum", name: "Mojo's Chaloklum", email: "mojos.chaloklum@gmail.com", region: "Koh Phangan", suppliers: ["makro-phangan", "winepro"] },
    { id: "thongsala", name: "Mojo's Thongsala", email: "mojos.thongsala@gmail.com", region: "Koh Phangan", suppliers: ["makro-phangan", "winepro"] },
    { id: "kaifchaloklum", name: "Kaif Chaloklum", email: "amazingphangan.kaif@gmail.com", region: "Koh Phangan", suppliers: ["makro-phangan", "winepro"] }
  ],
  // Each id must match a key in the DATA object in data.js.
  // Full list shown to a branch unless that branch has its own `suppliers` array (list of ids) above.
  // makro = Koh Samui Makro store (Nathon/Lamai). makro-phangan = Koh Phangan Makro store
  // (Chaloklum/Thongsala/Kaif) — separate item list & prices, same physical chain, different branch.
  suppliers: [
    { id: "makro", name: "Order Makro" },
    { id: "makro-phangan", name: "Order Makro" },
    { id: "foodproject", name: "Order Food Project" },
    { id: "drinks", name: "Order Drinks" },
    { id: "winepro", name: "Order Wine Pro" }
  ],
  // CC'd on every order email (leave "" to disable)
  ccEmail: ""
};
