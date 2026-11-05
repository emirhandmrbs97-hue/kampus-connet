import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, MessageCircle, Share2, ShoppingBag } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareSheet } from '@/components/ShareSheet';
import { Avatar, Button, Field, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { formatPrice, timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { sendMessage, startConversation } from '@/services/chat';
import { fetchProfiles } from '@/services/profiles';
import type { Attachment, ListingRow, Profile } from '@/types';

type OfferRow = { id: string; listing_id: string; buyer_id: string; amount: number; created_at: string };

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [buyers, setBuyers] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [offerOpen, setOfferOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
    const row = data as ListingRow | null;
    setListing(row);
    if (row) {
      const profiles = await fetchProfiles([row.seller_id]);
      setSeller(profiles[row.seller_id] ?? null);
      const { data: offerData } = await supabase
        .from('offers')
        .select('*')
        .eq('listing_id', row.id)
        .order('created_at', { ascending: false });
      const list = (offerData ?? []) as OfferRow[];
      setOffers(list);
      setBuyers(await fetchProfiles(list.map((o) => o.buyer_id)));
    }
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const isMine = !!listing && listing.seller_id === user?.id;

  const attachment: Attachment | null = listing
    ? {
        kind: 'listing',
        id: listing.id,
        title: listing.title,
        subtitle: formatPrice(listing.price),
        image: listing.image_url,
      }
    : null;

  const messageSeller = () => {
    if (!listing || !attachment) return;
    startConversation(listing.seller_id).then(({ id: cid, error }) => {
      if (error || !cid) return Alert.alert('Sohbet açılamadı', error ?? '');
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: cid,
          att_id: attachment.id,
          att_title: attachment.title,
          att_sub: attachment.subtitle ?? '',
          att_image: attachment.image ?? '',
        },
      });
    });
  };

  const submitOffer = async () => {
    if (!listing || !user || !attachment) return;
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return setAmountError('Geçerli bir tutar gir.');
    setAmountError(null);
    setBusy(true);
    const { error } = await supabase
      .from('offers')
      .insert({ listing_id: listing.id, buyer_id: user.id, amount: value });
    if (error) {
      setBusy(false);
      return setAmountError(error.message);
    }
    // Satıcıya otomatik mesaj (başarısız olursa teklif yine de kayıtlıdır)
    const conv = await startConversation(listing.seller_id);
    if (conv.id) {
      await sendMessage(conv.id, user.id, `${formatPrice(value)} teklif ediyorum.`, attachment);
    }
    setBusy(false);
    setOfferOpen(false);
    setAmount('');
    Alert.alert('Teklifin gönderildi', 'Satıcıya mesaj olarak da iletildi.');
    load();
  };

  const markSold = async () => {
    if (!listing) return;
    const { error } = await supabase.from('listings').update({ status: 'sold' }).eq('id', listing.id);
    if (error) return Alert.alert('Güncellenemedi', error.message);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator color="#0ea5e9" />
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <Text className="text-gray-600 dark:text-gray-300">İlan bulunamadı.</Text>
        <Button title="Geri dön" variant="outline" onPress={() => router.back()} className="mt-4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => router.back()} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <ChevronLeft size={22} color="#9ca3af" />
        </Pressable>
        <Pressable onPress={() => setShareOpen(true)} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <Share2 size={18} color="#9ca3af" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="pb-6">
        {listing.image_url ? (
          <Image source={{ uri: listing.image_url }} className="mx-4 h-72 rounded-3xl" resizeMode="cover" />
        ) : (
          <View className="mx-4 h-72 items-center justify-center rounded-3xl bg-gray-100 dark:bg-gray-800">
            <ShoppingBag size={40} color="#9ca3af" />
          </View>
        )}

        <View className="px-5 pt-5">
          <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">{listing.title}</Text>
          <Text className="mt-1 text-2xl font-extrabold text-primary-600">{formatPrice(listing.price)}</Text>

          <View className="mt-3 flex-row gap-2">
            <View className="rounded-full bg-primary-50 px-3 py-1.5 dark:bg-gray-800">
              <Text className="text-xs text-primary-700 dark:text-primary-300">{listing.category}</Text>
            </View>
            <View className="rounded-full bg-gray-100 px-3 py-1.5 dark:bg-gray-800">
              <Text className="text-xs text-gray-700 dark:text-gray-300">{listing.condition}</Text>
            </View>
            {listing.status === 'sold' ? (
              <View className="rounded-full bg-red-100 px-3 py-1.5">
                <Text className="text-xs text-red-700">Satıldı</Text>
              </View>
            ) : null}
          </View>

          {listing.description ? (
            <Text className="mt-4 text-base leading-6 text-gray-700 dark:text-gray-300">{listing.description}</Text>
          ) : null}

          <View className="mt-5 flex-row items-center rounded-2xl bg-gray-50 p-3 dark:bg-gray-800">
            <Avatar uri={seller?.avatar_url} name={seller?.full_name} size={44} />
            <View className="ml-3">
              <Text className="font-semibold text-gray-900 dark:text-white">{seller?.full_name || seller?.username}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                @{seller?.username} · {timeAgo(listing.created_at)}
              </Text>
            </View>
          </View>

          {isMine ? (
            <View className="mt-6">
              <Text className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Gelen teklifler</Text>
              {offers.length === 0 ? (
                <Text className="text-gray-500 dark:text-gray-400">Henüz teklif yok.</Text>
              ) : (
                offers.map((o) => (
                  <View key={o.id} className="mb-2 flex-row items-center rounded-2xl bg-gray-50 p-3 dark:bg-gray-800">
                    <Avatar uri={buyers[o.buyer_id]?.avatar_url} name={buyers[o.buyer_id]?.full_name} size={36} />
                    <Text className="ml-3 flex-1 text-gray-900 dark:text-white">@{buyers[o.buyer_id]?.username}</Text>
                    <Text className="font-bold text-primary-600">{formatPrice(o.amount)}</Text>
                  </View>
                ))
              )}
              {listing.status === 'active' ? (
                <Button title="Satıldı olarak işaretle" variant="outline" onPress={markSold} className="mt-3" />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {!isMine && listing.status === 'active' ? (
        <View className="flex-row gap-3 px-5 pb-2 pt-2">
          <Pressable
            onPress={messageSeller}
            className="flex-1 flex-row items-center justify-center rounded-2xl border border-gray-300 py-3.5 dark:border-gray-700"
          >
            <MessageCircle size={18} color="#0ea5e9" />
            <Text className="ml-2 font-semibold text-gray-900 dark:text-white">Satıcıya mesaj at</Text>
          </Pressable>
          <Button title="Teklif ver" onPress={() => setOfferOpen(true)} className="flex-1" />
        </View>
      ) : null}

      <Sheet visible={offerOpen} onClose={() => setOfferOpen(false)} title="Teklif ver">
        <Text className="mb-3 text-gray-500 dark:text-gray-400">İstenen fiyat: {formatPrice(listing.price)}</Text>
        <Field
          label="Teklifin (₺)"
          placeholder="Örn. 200"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          error={amountError}
        />
        <Button title="Teklifi gönder" onPress={submitOffer} loading={busy} />
      </Sheet>

      <ShareSheet
        attachment={shareOpen ? attachment : null}
        shareText={`${listing.title} - ${formatPrice(listing.price)}\nCampus Connect pazarında`}
        onClose={() => setShareOpen(false)}
      />
    </SafeAreaView>
  );
}
