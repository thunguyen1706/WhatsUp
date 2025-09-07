import { View, StyleSheet } from "react-native"
import type { ReactNode } from "react"

export default function MobileShell({
  children,
  header,
}: {
  children: ReactNode
  header?: ReactNode
}) {
  return (
    <View style={styles.container}>
      <View style={styles.phoneFrame}>
        {header && <View style={styles.header}>{header}</View>}
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minHeight: '100%',
    backgroundColor: '#F6F7FB',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 96,
  },
  phoneFrame: {
    maxWidth: 420,
    width: '100%',
    marginHorizontal: 'auto',
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 10,
  },
  header: {
    marginBottom: 12,
  },
})