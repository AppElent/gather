/**
 * A wishlist item's link and price (APP-306), on the task's detail screen.
 *
 * Both are typed in place and written when the field is left, like the title
 * and the notes: no Save. A link is only ever stored as http or https
 * (`normalizeTaskUrl`, and the backend checks again), so Open can hand it to
 * the system without a second thought; anything else stays in the field with
 * a line saying it is not a web address, and is not written.
 */
import { parseCents } from '@gather/core/finance'
import { normalizeTaskUrl } from '@gather/core/task-lists'
import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { UI_ICONS } from '../../theme/icons'
import { TYPE, useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { TASK_ICONS } from './icons'
import { useTaskActions } from './store'
import type { Task } from './types'
import { priceText } from './wishlist'

export function WishlistFields({
  task,
  writable,
}: {
  task: Task
  writable: boolean
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const actions = useTaskActions()
  const [link, setLink] = useState(task.url ?? '')
  const [price, setPrice] = useState(priceText(task.priceCents, locale))
  const [badLink, setBadLink] = useState(false)

  // Somebody else's edit arrives while the field is not being typed in.
  useEffect(() => setLink(task.url ?? ''), [task.url])
  useEffect(
    () => setPrice(priceText(task.priceCents, locale)),
    [task.priceCents, locale],
  )

  const saveLink = () => {
    const typed = link.trim()
    if (!typed) {
      setBadLink(false)
      if (task.url !== undefined) actions.setUrl(task.id, null)
      return
    }
    const url = normalizeTaskUrl(typed)
    if (!url) {
      setBadLink(true)
      haptics.actionFailed()
      return
    }
    setBadLink(false)
    setLink(url)
    if (url !== task.url) actions.setUrl(task.id, url)
  }

  const savePrice = () => {
    const typed = price.replace(/[€\s]/g, '')
    if (!typed) {
      if (task.priceCents !== undefined) actions.setPrice(task.id, null)
      return
    }
    const cents = parseCents(typed)
    if (cents === null || cents < 0) {
      // Not a price: put back the one that was there.
      setPrice(priceText(task.priceCents, locale))
      haptics.actionFailed()
      return
    }
    setPrice(priceText(cents, locale))
    if (cents !== task.priceCents) actions.setPrice(task.id, cents)
  }

  const openable = task.url ? normalizeTaskUrl(task.url) : null

  return (
    <>
      <Card>
        <View
          style={[
            styles.row,
            {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: tokens.hair,
            },
          ]}
        >
          <TASK_ICONS.Link
            size={18}
            color={tokens.muted}
            strokeWidth={2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.label, { color: tokens.ink }]}>
            {t.tasks.wishlist.link}
          </Text>
          <TextInput
            testID="detail-link"
            value={link}
            onChangeText={(next) => {
              setLink(next)
              setBadLink(false)
            }}
            onBlur={saveLink}
            onSubmitEditing={saveLink}
            editable={writable}
            placeholder={t.tasks.wishlist.linkPlaceholder}
            placeholderTextColor={tokens.muted}
            accessibilityLabel={t.tasks.wishlist.link}
            keyboardType="url"
            textContentType="URL"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            numberOfLines={1}
            style={[styles.input, { color: tokens.ink }]}
          />
          {openable ? (
            <Pressable
              testID="detail-open-link"
              accessibilityRole="link"
              accessibilityLabel={t.tasks.wishlist.openLink}
              hitSlop={12}
              onPress={() => {
                Linking.openURL(openable).catch(() =>
                  showAlert(t.errors.openPageFailed),
                )
              }}
            >
              <UI_ICONS.ExternalLink
                size={18}
                color={tokens.accentText}
                strokeWidth={2.2}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.row}>
          <TASK_ICONS.Price
            size={18}
            color={tokens.muted}
            strokeWidth={2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.label, styles.grow, { color: tokens.ink }]}>
            {t.tasks.wishlist.price}
          </Text>
          <Text style={[styles.currency, { color: tokens.muted }]}>€</Text>
          <TextInput
            testID="detail-price"
            value={price}
            onChangeText={setPrice}
            onBlur={savePrice}
            onSubmitEditing={savePrice}
            editable={writable}
            placeholder={t.tasks.wishlist.pricePlaceholder}
            placeholderTextColor={tokens.muted}
            accessibilityLabel={t.tasks.wishlist.price}
            // Not `decimal-pad`: it has no return key on iPhone, and on a
            // detail screen too short to drag, nothing would put it away.
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            style={[styles.input, styles.price, { color: tokens.ink }]}
          />
        </View>
      </Card>
      {badLink && link.trim() ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: tokens.danger }]}
        >
          {t.tasks.wishlist.invalidLink}
        </Text>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 52,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  label: { ...TYPE.body },
  input: {
    ...TYPE.subhead,
    flex: 1,
    minHeight: 44,
    textAlign: 'right',
    padding: 0,
  },
  price: { flex: 0, minWidth: 72 },
  grow: { flex: 1 },
  currency: { ...TYPE.subhead },
  error: { ...TYPE.footnote, paddingHorizontal: 4 },
})
