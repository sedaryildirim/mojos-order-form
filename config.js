// ---- Edit this file to update branches / email addresses ----
// No coding needed elsewhere: item list/prices/pars live in data.js.

const CONFIG = {
  branches: [
    { id: "nathon", name: "Nathon", email: "mojos.nathon@gmail.com" },
    { id: "lamai", name: "Lamai", email: "mojos.lamai@gmail.com" }
  ],
  // Each id must match a key in the DATA object in data.js
  suppliers: [
    { id: "makro", name: "Order Makro" },
    { id: "foodproject", name: "Order Food Project" },
    { id: "drinks", name: "Order Drinks" },
    { id: "winepro", name: "Order Wine Pro" }
  ],
  // CC'd on every order email (leave "" to disable)
  ccEmail: ""
};
