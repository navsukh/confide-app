import React from "react";
import { Modal, View, Text, Pressable, FlatList, StyleSheet } from "react-native";

/**
 * Fixed topic list instead of free text — per product decision, users pick
 * rather than type. The "self-harm" entry deliberately maps to the exact
 * tag the backend's hard crisis-exclusion checks for (lib/crisis.ts on the
 * backend) — selecting it still routes to crisis resources instead of
 * matching, same as before this became a picker.
 */
export interface Topic {
  tag: string;
  label: string;
  isCrisis?: boolean;
}

export const TOPICS: Topic[] = [
  { tag: "work-stress", label: "Work & career stress" },
  { tag: "breakup", label: "Breakup or relationship issues" },
  { tag: "loneliness", label: "Loneliness" },
  { tag: "family-conflict", label: "Family conflict" },
  { tag: "anxiety", label: "Anxiety" },
  { tag: "grief", label: "Grief & loss" },
  { tag: "general", label: "Just want to talk" },
  { tag: "self-harm", label: "Self-harm or suicidal thoughts", isCrisis: true },
];

interface Props {
  visible: boolean;
  selectedTag: string | null;
  onSelect: (topic: Topic) => void;
  onClose: () => void;
}

export default function TopicPickerModal({ visible, selectedTag, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>What would you like to talk about?</Text>
          <FlatList
            data={TOPICS}
            keyExtractor={(t) => t.tag}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.row,
                  selectedTag === item.tag && styles.rowActive,
                  item.isCrisis && styles.rowCrisis,
                ]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={[styles.rowText, item.isCrisis && styles.rowCrisisText]}>{item.label}</Text>
              </Pressable>
            )}
          />
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1c1830",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "75%",
  },
  title: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 12 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#221e33",
  },
  rowActive: { backgroundColor: "#7c5cff" },
  rowCrisis: { backgroundColor: "#2e1f26", borderWidth: 1, borderColor: "#e5484d" },
  rowText: { color: "#fff", fontSize: 15 },
  rowCrisisText: { color: "#ff9b9e" },
  cancelButton: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  cancelText: { color: "#a39cb5", fontSize: 14 },
});
