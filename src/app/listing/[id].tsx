import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { ChevronLeft, FileText, Heart, MessageCircle, Share2, ShoppingBag } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareSheet } from '@/components/ShareSheet';
import { StorageImage } from '@/components/StorageImage';
import { getMarketplaceCategoryLabel, isNoteMarketplaceCategory } from '@/constants/marketplaceCategories';
import { Avatar, Button, Field, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { formatPrice, timeAgo } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { sendMessage, startConversation } from '@/services/chat';
import { fetchProfiles } from '@/services/profiles';
import { resolveMarketplacePdfUrl } from '@/services/storageService';
import type { Attachment, ListingPdfAccessRow, ListingRow, Profile } from '@/types';

type OfferRow = { id: string; listing_id: string; buyer_id: string; amount: number; created_at: string };

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [pdfAccessRequests, setPdfAccessRequests] = useState<ListingPdfAccessRow[]>([]);
  const [buyers, setBuyers] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [offerOpen, setOfferOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listingLikeCount, setListingLikeCount] = useState(0);
  const [likedListing, setLikedListing] = useState(false);
  const [liking, setLiking] = useState(false);
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
      const { data: accessData, error: accessError } = await supabase
        .from('listing_pdf_access')
        .select('*')
        .eq('listing_id', row.id)
        .order('created_at', { ascending: false });
      if (accessError) throw accessError;
      const requests = (accessData ?? []) as ListingPdfAccessRow[];
      setPdfAccessRequests(requests);
      const { data: likeData, error: likeError } = await supabase
        .from('listing_likes')
        .select('user_id')
        .eq('listing_id', row.id);
      if (likeError) throw likeError;
      setListingLikeCount(likeData?.length ?? 0);
      setLikedListing((likeData ?? []).some((like) => like.user_id === user?.id));
      const list = (offerData ?? []) as OfferRow[];
      setOffers(list);
      setBuyers(
        await fetchProfiles([
          ...list.map((o) => o.buyer_id),
          ...requests.map((request) => request.buyer_id),
        ]),
      );
    }
  }, [id, user?.id]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve()
      .then(load)
      .catch((error) => {
        Alert.alert(
          'İlan yüklenemedi',
          error instanceof Error ? error.message : JSON.stringify(error),
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [load]);

  const isMine = !!listing && listing.seller_id === user?.id;
  const isNoteListing = !!listing && isNoteMarketplaceCategory(listing.category);
  const myPdfAccess = pdfAccessRequests.find((request) => request.buyer_id === user?.id);
  const canOpenPdf = isMine || myPdfAccess?.status === 'approved';

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

  const toggleListingLike = async () => {
    if (!listing || !user || isMine || liking) return;
    const nextLiked = !likedListing;
    setLiking(true);
    setLikedListing(nextLiked);
    setListingLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    const { error } = nextLiked
      ? await supabase.from('listing_likes').insert({ listing_id: listing.id, user_id: user.id })
      : await supabase
          .from('listing_likes')
          .delete()
          .eq('listing_id', listing.id)
          .eq('user_id', user.id);
    setLiking(false);
    if (error) {
      setLikedListing(!nextLiked);
      setListingLikeCount((count) => Math.max(0, count + (nextLiked ? -1 : 1)));
      Alert.alert('İlan beğenisi güncellenemedi', error.message);
    }
  };

  const markSold = async () => {
    if (!listing) return;
    const { error } = await supabase.from('listings').update({ status: 'sold' }).eq('id', listing.id);
    if (error) return Alert.alert('Güncellenemedi', error.message);
    load();
  };

  const requestPdfAccess = async () => {
    if (!listing || !user) return;
    setBusy(true);
    try {
      if (myPdfAccess?.status === 'rejected') {
        const { error: deleteError } = await supabase
          .from('listing_pdf_access')
          .delete()
          .eq('id', myPdfAccess.id);
        if (deleteError) throw deleteError;
      }
      const { error } = await supabase
        .from('listing_pdf_access')
        .insert({ listing_id: listing.id, buyer_id: user.id, status: 'pending' });
      if (error) throw error;
      await load();
      Alert.alert('İstek gönderildi', 'Satıcı onaylayınca PDF’i açabileceksin.');
    } catch (error) {
      Alert.alert('İstek gönderilemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const respondToPdfRequest = async (requestId: string, approve: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc('respond_to_listing_pdf_access', {
      p_request_id: requestId,
      p_approve: approve,
    });
    setBusy(false);
    if (error) {
      Alert.alert('İstek güncellenemedi', error.message);
      return;
    }
    await load();
  };

  const openNotePdf = async () => {
    if (!listing?.pdf_url) return Alert.alert('PDF bulunamadı', 'Bu not için PDF dosyası yüklenmemiş.');
    if (!canOpenPdf) {
      return Alert.alert('Erişim gerekli', 'PDF’i yalnızca satıcı onayından sonra açabilirsin.');
    }
    try {
      const signedUrl = await resolveMarketplacePdfUrl(listing.pdf_url);
      await Linking.openURL(signedUrl);
    } catch (error) {
      Alert.alert('PDF açılamadı', error instanceof Error ? error.message : 'Dosya açılırken bir hata oluştu.');
    }
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
        <Button title="Geri dön" variant="outline" onPress={() => goBack('/(tabs)/marketplace')} className="mt-4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => goBack('/(tabs)/marketplace')} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <ChevronLeft size={22} color="#9ca3af" />
        </Pressable>
        <Pressable onPress={() => setShareOpen(true)} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <Share2 size={18} color="#9ca3af" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="pb-6">
        {listing.image_url ? (
          <StorageImage uri={listing.image_url} className="mx-4 h-72 rounded-3xl" resizeMode="cover" />
        ) : (
          <View className="mx-4 h-72 items-center justify-center rounded-3xl bg-gray-100 dark:bg-gray-800">
            <ShoppingBag size={40} color="#9ca3af" />
          </View>
        )}

        <View className="px-5 pt-5">
          <View className="flex-row items-start justify-between">
            <Text className="mr-3 flex-1 text-2xl font-extrabold text-gray-900 dark:text-white">
              {listing.title}
            </Text>
            {!isMine ? (
              <Pressable
                onPress={() => void toggleListingLike()}
                disabled={liking}
                accessibilityRole="button"
                accessibilityLabel={likedListing ? 'İlan beğenisini kaldır' : 'İlanı beğen'}
                className="flex-row items-center rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-800"
              >
                <Heart
                  size={19}
                  color={likedListing ? '#ef4444' : '#6b7280'}
                  fill={likedListing ? '#ef4444' : 'transparent'}
                />
                <Text className="ml-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {listingLikeCount}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text className="mt-1 text-2xl font-extrabold text-primary-600">{formatPrice(listing.price)}</Text>

          <View className="mt-3 flex-row gap-2">
            <View className="rounded-full bg-primary-50 px-3 py-1.5 dark:bg-gray-800">
              <Text className="text-xs text-primary-700 dark:text-primary-300">
                {getMarketplaceCategoryLabel(listing.category)}
              </Text>
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

          {isNoteListing ? (
            <View className="mt-4 rounded-2xl bg-red-50 p-4 dark:bg-gray-800">
              <View className="flex-row items-center">
                <FileText size={24} color="#dc2626" />
                <View className="ml-3 flex-1">
                  <Text numberOfLines={1} className="font-semibold text-gray-900 dark:text-white">
                    {listing.pdf_file_name ?? 'Ders notu PDF'}
                  </Text>
                  <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {listing.pdf_size == null ? 'PDF dosyası' : `${(listing.pdf_size / (1024 * 1024)).toFixed(1)} MB`}
                  </Text>
                </View>
              </View>
              <Text className="mt-3 text-sm leading-5 text-gray-700 dark:text-gray-300">
                {[
                  listing.university_name,
                  listing.department_name,
                  listing.grade_level,
                ].filter(Boolean).join(' · ')}
              </Text>
              {listing.pdf_url && canOpenPdf ? (
                <Pressable
                  onPress={openNotePdf}
                  className="mt-4 items-center rounded-xl bg-red-600 px-4 py-3"
                >
                  <Text className="font-semibold text-white">PDF dosyasını aç</Text>
                </Pressable>
              ) : listing.pdf_url && !isMine ? (
                <View className="mt-4">
                  {myPdfAccess?.status === 'pending' ? (
                    <Text className="text-center text-sm font-medium text-primary-700 dark:text-primary-300">
                      Satıcı onayı bekleniyor
                    </Text>
                  ) : (
                    <Button
                      title={myPdfAccess?.status === 'rejected' ? 'Yeniden erişim iste' : 'PDF erişimi iste'}
                      onPress={() => void requestPdfAccess()}
                      loading={busy}
                    />
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="mt-5 flex-row items-center rounded-2xl bg-gray-50 p-3 dark:bg-gray-800">
            <Pressable
              onPress={() =>
                seller?.id && router.push({ pathname: '/profile/[id]', params: { id: seller.id } })
              }
            >
              <Avatar uri={seller?.avatar_url} name={seller?.full_name} size={44} />
            </Pressable>
            <Pressable
              onPress={() =>
                seller?.id && router.push({ pathname: '/profile/[id]', params: { id: seller.id } })
              }
              className="ml-3"
            >
              <Text className="font-semibold text-gray-900 dark:text-white">{seller?.full_name || seller?.username}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                @{seller?.username} · {timeAgo(listing.created_at)}
              </Text>
            </Pressable>
          </View>

          {isMine ? (
            <View className="mt-6">
              {isNoteListing && pdfAccessRequests.length > 0 ? (
                <View className="mb-5">
                  <Text className="mb-2 text-lg font-bold text-gray-900 dark:text-white">PDF erişim istekleri</Text>
                  {pdfAccessRequests.map((request) => (
                    <View key={request.id} className="mb-2 flex-row items-center rounded-2xl bg-gray-50 p-3 dark:bg-gray-800">
                      <Avatar uri={buyers[request.buyer_id]?.avatar_url} name={buyers[request.buyer_id]?.full_name} size={36} />
                      <Text className="ml-3 flex-1 text-gray-900 dark:text-white">
                        @{buyers[request.buyer_id]?.username ?? 'Kullanıcı'} · {request.status === 'approved' ? 'Onaylandı' : request.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                      </Text>
                      {request.status === 'pending' ? (
                        <Pressable
                          onPress={() => void respondToPdfRequest(request.id, true)}
                          disabled={busy}
                          className="rounded-xl bg-primary-500 px-3 py-2"
                        >
                          <Text className="text-xs font-semibold text-white">Onayla</Text>
                        </Pressable>
                      ) : null}
                      {request.status === 'pending' ? (
                        <Pressable
                          onPress={() => void respondToPdfRequest(request.id, false)}
                          disabled={busy}
                          className="ml-2 rounded-xl bg-gray-200 px-3 py-2 dark:bg-gray-700"
                        >
                          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-100">Reddet</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
              <Text className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Gelen teklifler</Text>
              {offers.length === 0 ? (
                <Text className="text-gray-500 dark:text-gray-400">Henüz teklif yok.</Text>
              ) : (
                offers.map((o) => (
                  <View key={o.id} className="mb-2 flex-row items-center rounded-2xl bg-gray-50 p-3 dark:bg-gray-800">
                    <Pressable onPress={() => router.push({ pathname: '/profile/[id]', params: { id: o.buyer_id } })}>
                      <Avatar uri={buyers[o.buyer_id]?.avatar_url} name={buyers[o.buyer_id]?.full_name} size={36} />
                    </Pressable>
                    <Pressable
                      onPress={() => router.push({ pathname: '/profile/[id]', params: { id: o.buyer_id } })}
                      className="ml-3 flex-1"
                    >
                      <Text className="text-gray-900 dark:text-white">@{buyers[o.buyer_id]?.username}</Text>
                    </Pressable>
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
          {isNoteListing ? null : (
            <Button title="Teklif ver" onPress={() => setOfferOpen(true)} className="flex-1" />
          )}
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
        shareText={`${listing.title} - ${formatPrice(listing.price)}\nKampüsHub pazarında`}
        onClose={() => setShareOpen(false)}
      />
    </SafeAreaView>
  );
}
