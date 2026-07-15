import { ScrollView, StyleSheet, Text, useColorScheme } from "react-native";

export default function HomeScreen() {
  const isDark = useColorScheme() === "dark";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={isDark ? styles.screenDark : styles.screenLight}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}
      >
        Hello world
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  screenLight: {
    backgroundColor: "#f7f7f8",
  },
  screenDark: {
    backgroundColor: "#101114",
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
  },
  titleLight: {
    color: "#171717",
  },
  titleDark: {
    color: "#f5f5f5",
  },
});
