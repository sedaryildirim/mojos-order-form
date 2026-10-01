import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatTHB } from "./currency";
import { gpFromSellingPrice, suggestedPriceFromTargetGp } from "./costing";
import { SpecSheetVersion } from "@/components/SpecSheet";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
  summary: { marginTop: 16, backgroundColor: "#f5f5f5", padding: 12 },
});

export async function renderSpecSheetPdf(version: SpecSheetVersion): Promise<Buffer> {
  const cost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const targetGpPct = version.targetGpPct ? Number(version.targetGpPct) : null;
  const gp = gpFromSellingPrice(cost, sellingPrice);
  const suggestedPrice = targetGpPct !== null ? suggestedPriceFromTargetGp(cost, targetGpPct) : null;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{version.dish.name} (v{version.versionNumber})</Text>
        {version.notes && <Text>{version.notes}</Text>}
        {version.lines.map((line) => (
          <View key={line.id} style={styles.row}>
            {/*
              `line.quantity` is typed `string` here, but the real caller
              (the PDF download route) fetches the version via
              `prisma.dishVersion.findUnique(...)` and passes it straight
              through, where `quantity` is a `@db.Decimal` field
              materialized as a live Decimal object instance, not a
              primitive string. React (and @react-pdf/renderer, which
              follows React's reconciler conventions) rejects non-primitive
              objects as JSX children. Wrapping with String(...) — the same
              pattern used in src/lib/diff.ts for this identical
              Decimal-interpolation problem — is a no-op for plain strings
              and correctly calls .toString() for Decimal-like objects.
            */}
            <Text>{line.ingredientNameSnapshot}: {String(line.quantity)} {line.unit}</Text>
            <Text>{formatTHB(Number(line.lineCostSnapshot))}</Text>
          </View>
        ))}
        <View style={styles.summary}>
          <Text>Cost: {formatTHB(cost)}</Text>
          {sellingPrice && <Text>Selling price: {formatTHB(sellingPrice)}</Text>}
          <Text>GP: {gp ? `${formatTHB(gp.gpThb)} (${(gp.gpPct * 100).toFixed(1)}%)` : "not set"}</Text>
          {suggestedPrice !== null && <Text>Suggested price for {targetGpPct}% target GP: {formatTHB(suggestedPrice)}</Text>}
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
