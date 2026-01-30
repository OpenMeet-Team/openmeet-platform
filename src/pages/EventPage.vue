<template>
  <q-page padding style="max-width: 1201px" class="q-mx-auto c-event-page">
    <SpinnerComponent v-if="useEventStore().isLoading" />
    <div v-else-if="event" class="row q-col-gutter-md">
      <!-- Main content column -->
      <div class="col-12 col-md-8">
        <!-- Photo (Mobile: 1st) - Only show if event has an actual image -->
        <q-card v-if="event?.image" class="q-mb-md">
          <q-img
            data-cy="event-image"
            :src="eventImageSrc"
            :ratio="16/9"
            spinner-color="primary"
            style="min-height: 300px"
          />
        </q-card>

        <!-- Description (Mobile: 2nd) -->
        <q-card class="q-mb-md">
          <q-card-section>
            <!-- Title -->
            <div
              data-cy="event-name"
              class="text-h4 text-bold q-py-sm"
            >
              {{ event.name }}
            </div>
            <!-- Series Information -->
            <div v-if="event.seriesSlug" class="q-mb-md">
              <q-badge color="primary" class="q-mb-sm">Part of a Series</q-badge>
              <div class="text-h6 text-bold">{{ event.series?.name }}</div>
              <div class="text-body2 q-mt-sm">{{ event.series?.description }}</div>
            </div>
            <div
              data-cy="event-description"
              class="text-body1 q-mt-md bio-content"
            >
              <q-markdown v-if="event.description" :src="event.description" />
              <div v-else class="text-grey-6 text-italic">No description provided</div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Event Actions - Mobile only (Mobile: 3rd) -->
        <q-card class="q-mb-md lt-md event-actions-mobile">
          <q-card-section class="event-actions-content">
            <div class="text-h6 q-mb-md">Event Actions</div>
            <div class="column q-gutter-md">
              <!-- RSVP SECTION -->
              <EventRSVPSection
                :event="event"
                :is-template-view="isTemplateView"
                :template-date="templateDate"
              />

              <!-- EVENT STATUS (only show if there's status to display) -->
              <div v-if="event.status === 'cancelled' || isTemplateView">
                <q-separator class="q-my-md" />

                <div class="event-quick-details">
                  <!-- Event status badges -->
                  <div v-if="event.status === 'cancelled'" class="q-mb-md">
                    <q-badge color="red" class="text-bold">
                      <q-icon name="sym_r_cancel" size="xs" class="q-mr-xs" />
                      Event Cancelled
                    </q-badge>
                  </div>

                  <div v-if="isTemplateView" class="text-caption text-info q-mb-md">
                    <q-icon name="sym_r_info" size="xs" class="q-mr-xs" />
                    This is a future occurrence. Editing or adding attendees will create a scheduled event.
                  </div>
                </div>
              </div>

              <q-separator class="q-my-md" />

              <!-- Organizer tools -->
              <div
                v-if="
                  useEventStore().getterGroupMemberHasPermission(
                    GroupPermission.ManageEvents
                  ) ||
                  useEventStore().getterUserHasPermission(
                    EventAttendeePermission.ManageEvent
                  ) ||
                  isOwnerOrAdmin
                "
                class="q-mt-md"
              >
                <span
                  class="text-overline text-grey-6"
                  v-if="event.status === EventStatus.Draft"
                  >{{ event.status }}</span
                >
                <q-btn-dropdown
                  data-cy="Organizer-tools"
                  ripple
                  color="primary"
                  outline
                  no-caps
                  label="Organizer tools"
                  icon="sym_r_settings"
                  class="full-width action-button"
                >
                  <q-list>
                    <MenuItemComponent
                      label="Edit event"
                      icon="sym_r_edit_note"
                      v-if="
                        useEventStore().getterUserHasPermission(
                          EventAttendeePermission.ManageEvent
                        ) ||
                        isOwnerOrAdmin ||
                        useEventStore().getterGroupMemberHasPermission(
                          GroupPermission.ManageEvents
                        )
                      "
                      @click="handleEditEvent"
                    />
                    <MenuItemComponent
                      label="Duplicate event"
                      icon="sym_r_content_copy"
                      v-if="
                        useEventStore().getterUserHasPermission(
                          EventAttendeePermission.ManageEvent
                        ) ||
                        isOwnerOrAdmin ||
                        useEventStore().getterGroupMemberHasPermission(
                          GroupPermission.ManageEvents
                        )
                      "
                      @click="handleDuplicateEvent"
                    />
                    <MenuItemComponent
                      label="Manage attendees"
                      icon="sym_r_people"
                      v-if="
                        useEventStore().getterUserHasPermission(
                          EventAttendeePermission.ManageAttendees
                        )
                      "
                      @click="router.push({ name: 'EventAttendeesPage' })"
                    />
                    <MenuItemComponent
                      v-if="
                        event.status === EventStatus.Published &&
                        (useEventStore().getterUserHasPermission(
                          EventAttendeePermission.CancelEvent
                        ) ||
                        isOwnerOrAdmin ||
                        useEventStore().getterGroupMemberHasPermission(
                          GroupPermission.ManageEvents
                        ))
                      "
                      label="Cancel event"
                      icon="sym_r_event_busy"
                      @click="onCancelEvent"
                    />

                    <MenuItemComponent
                      v-if="
                        event.status === EventStatus.Cancelled &&
                        (useEventStore().getterUserHasPermission(
                          EventAttendeePermission.CancelEvent
                        ) ||
                        isOwnerOrAdmin ||
                        useEventStore().getterGroupMemberHasPermission(
                          GroupPermission.ManageEvents
                        ))
                      "
                      label="Republish event"
                      icon="sym_r_event_available"
                      @click="onRepublishEvent"
                    />

                    <q-separator />
                    <MenuItemComponent
                      label="Delete event"
                      v-if="
                        useEventStore().getterUserHasPermission(
                          EventAttendeePermission.DeleteEvent
                        ) ||
                        isOwnerOrAdmin ||
                        useEventStore().getterGroupMemberHasPermission(
                          GroupPermission.ManageEvents
                        )
                      "
                      icon="sym_r_delete"
                      @click="onDeleteEvent"
                    />
                  </q-list>
                </q-btn-dropdown>
              </div>

              <div class="column q-gutter-md">
                <!-- Share button -->
                <q-btn-dropdown
                  no-caps
                  color="primary"
                  outline
                  icon="sym_r_share"
                  label="Share"
                  data-cy="share-button"
                  class="full-width action-button"
                >
                  <q-list>
                    <MenuItemComponent
                      label="Bluesky"
                      icon="fab fa-bluesky"
                      icon-color="blue"
                      @click="shareTo('bluesky')"
                    />
                    <MenuItemComponent
                      label="Facebook"
                      icon="fab fa-facebook"
                      icon-color="blue"
                      @click="shareTo('facebook')"
                    />
                    <MenuItemComponent
                      label="X"
                      icon="fab fa-square-x-twitter"
                      icon-color="black"
                      @click="shareTo('x')"
                    />
                    <MenuItemComponent
                      label="LinkedIn"
                      icon="fab fa-linkedin"
                      icon-color="blue-8"
                      @click="shareTo('linkedin')"
                    />
                    <MenuItemComponent
                      label="WhatsApp"
                      icon="fab fa-whatsapp"
                      icon-color="green"
                      @click="shareTo('whatsapp')"
                    />
                    <MenuItemComponent
                      label="Email"
                      icon="sym_r_mail"
                      icon-color="red"
                      @click="shareToEmail"
                    />
                  </q-list>
                </q-btn-dropdown>

                <!-- Contact Organizers button - only show for attendees who don't have manage permissions -->
                <q-btn
                  v-if="
                    useEventStore().getterUserIsAttendee() &&
                    !useEventStore().getterUserHasPermission(EventAttendeePermission.ManageEvent)
                  "
                  label="Contact Organizers"
                  color="primary"
                  outline
                  icon="sym_r_mail"
                  @click="onContactOrganizers"
                  data-cy="contact-organizers-btn"
                  no-caps
                  class="full-width action-button"
                />

                <!-- QR Code button -->
                <q-btn
                  no-caps
                  color="primary"
                  outline
                  icon="sym_r_qr_code"
                  label="Generate QR Code"
                  data-cy="qr-code-button"
                  class="full-width action-button"
                  @click="showQRCodePopup = true"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Event Details - Mobile only (Mobile: 4th) -->
        <q-card class="q-mb-md lt-md">
          <q-card-section>
            <div class="text-h6">Event Details</div>

            <!-- Hosted by -->
            <EventLeadComponent />

            <!-- Date and time -->
            <q-item>
              <q-item-section side>
                <q-icon name="sym_r_schedule" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ dateFormatting.formatWithTimezone(
                    event.startDate,
                    { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                    dateFormatting.getUserTimezone() || event.timeZone
                  ) }}
                </q-item-label>
                <q-item-label v-if="event.endDate">
                  {{ dateFormatting.formatWithTimezone(
                    event.endDate,
                    { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                    dateFormatting.getUserTimezone() || event.timeZone
                  ) }}
                </q-item-label>
                <q-item-label caption v-if="event.timeZone && dateFormatting.getUserTimezone() && event.timeZone !== dateFormatting.getUserTimezone()">
                  <div class="row items-center q-gutter-sm q-mt-sm">
                    <span class="text-italic">
                      Event time in original timezone ({{ event.timeZone }}):
                      {{ dateFormatting.formatWithTimezone(event.startDate, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }, event.timeZone) }}
                    </span>
                  </div>
                </q-item-label>
                <q-item-label caption>
                  <div class="row items-center q-gutter-sm q-mt-sm">
                    <span class="text-italic">
                      Dates shown in your local time{{ dateFormatting.getUserTimezone() ? ` (${dateFormatting.getUserTimezone()})` : '' }}
                    </span>
                  </div>
                </q-item-label>
              </q-item-section>
            </q-item>

            <!-- Spots left -->
            <q-item v-if="event.maxAttendees">
              <q-item-section side>
                <q-icon name="sym_r_group" />
              </q-item-section>
              <q-item-section>
                <q-item-label v-if="spotsLeft > 0">
                  <q-badge color="warning" class="text-bold">
                    {{ spotsLeft }} {{ pluralize(spotsLeft, "spot") }} left
                  </q-badge>
                </q-item-label>
                <q-item-label v-else>
                  <q-badge color="negative" class="text-bold">
                    Event Full
                  </q-badge>
                </q-item-label>
              </q-item-section>
            </q-item>

            <!-- Recurrence information -->
            <RecurrenceDisplayComponent v-if="event.isRecurring" :event="event" />

            <!-- Location and type -->
            <q-item>
              <q-item-section side>
                <q-icon
                  label="In person"
                  v-if="event.type === 'in-person'"
                  icon="sym_r_person_pin_circle"
                  name="sym_r_person_pin_circle"
                />
                <q-icon
                  label="Online"
                  v-if="event.type === 'online'"
                  name="sym_r_videocam"
                />
                <q-icon
                  label="Hybrid"
                  v-if="event.type === 'hybrid'"
                  name="sym_r_diversity_2"
                />
              </q-item-section>
              <q-item-section>
                <div class="row items-center">
                  <q-item-label>{{ event.type }} event</q-item-label>
                  <q-badge
                    v-if="event.sourceType"
                    :color="getSourceColor(event.sourceType)"
                    class="q-ml-sm"
                  >
                    <q-icon
                      v-if="event.sourceType === 'bluesky'"
                      name="fa-brands fa-bluesky"
                      size="xs"
                      class="q-mr-xs"
                    />
                    {{ event.sourceType }}
                  </q-badge>
                  <a
                    v-if="event.atprotoUri"
                    :href="'https://pds.ls/' + event.atprotoUri"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="q-ml-sm"
                    title="View on AT Protocol"
                  >
                    <q-badge color="blue">
                      <q-icon name="fa-solid fa-at" size="xs" class="q-mr-xs" />
                      Published
                    </q-badge>
                  </a>
                </div>
                <q-btn
                  v-if="event.locationOnline"
                  no-caps
                  size="md"
                  align="left"
                  flat
                  padding="none"
                  target="_blank"
                  :href="event.locationOnline"
                  class="text-underline text-blue"
                  >Online link
                </q-btn>
                <q-item-label v-if="event.location" class="text-blue">
                  {{ event.location }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <!-- Map display when event has location -->
            <q-item v-if="event.lat && event.lon">
              <q-item-section>
                <div class="q-mt-md">
                  <LeafletMapComponent
                    disabled
                    :lat="event.lat"
                    :lon="event.lon"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-card-section>
        </q-card>

        <!-- Chatroom (Mobile: 5th, Desktop: continues in left column) -->
        <EventMatrixChatComponent />

        <!-- Attendees (Mobile: 6th, Desktop: continues in left column) -->
        <EventAttendeesComponent />

        <!-- Activity Feed -->
        <EventActivityFeedComponent
          :event-slug="event.slug"
          :group-slug="event.group?.slug"
        />
      </div>

      <!-- Sidebar - Desktop only -->
      <div class="col-12 col-md-4 gt-sm">
        <div>

          <!-- Event actions card (desktop only - mobile version below) -->
          <q-card class="q-mb-md event-actions-card">
            <q-card-section class="event-actions-content">
              <div class="text-h6 q-mb-md">Event Actions</div>
              <div class="column q-gutter-md">

                <!-- RSVP SECTION -->
                <EventRSVPSection
                  :event="event"
                  :is-template-view="isTemplateView"
                  :template-date="templateDate"
                />

                <!-- EVENT STATUS (only show if there's status to display) -->
                <div v-if="event.status === 'cancelled' || isTemplateView">
                  <q-separator class="q-my-md" />

                  <div class="event-quick-details">
                    <!-- Event status badges -->
                    <div v-if="event.status === 'cancelled'" class="q-mb-md">
                      <q-badge color="red" class="text-bold">
                        <q-icon name="sym_r_cancel" size="xs" class="q-mr-xs" />
                        Event Cancelled
                      </q-badge>
                    </div>

                    <div v-if="isTemplateView" class="text-caption text-info q-mb-md">
                      <q-icon name="sym_r_info" size="xs" class="q-mr-xs" />
                      This is a future occurrence. Editing or adding attendees will create a scheduled event.
                    </div>
                  </div>
                </div>

                <q-separator class="q-my-md" />

                <!-- Organizer tools -->
                <div
                  v-if="
                    useEventStore().getterGroupMemberHasPermission(
                      GroupPermission.ManageEvents
                    ) ||
                    useEventStore().getterUserHasPermission(
                      EventAttendeePermission.ManageEvent
                    ) ||
                    isOwnerOrAdmin
                  "
                  class="q-mt-md"
                >
                  <span
                    class="text-overline text-grey-6"
                    v-if="event.status === EventStatus.Draft"
                    >{{ event.status }}</span
                  >
                  <q-btn-dropdown
                    data-cy="Organizer-tools"
                    ripple
                    color="primary"
                    outline
                    no-caps
                    label="Organizer tools"
                    icon="sym_r_settings"
                    class="full-width action-button"
                  >
                    <q-list>
                      <MenuItemComponent
                        label="Edit event"
                        icon="sym_r_edit_note"
                        v-if="
                          useEventStore().getterUserHasPermission(
                            EventAttendeePermission.ManageEvent
                          ) ||
                          isOwnerOrAdmin ||
                          useEventStore().getterGroupMemberHasPermission(
                            GroupPermission.ManageEvents
                          )
                        "
                        @click="handleEditEvent"
                      />
                      <MenuItemComponent
                        label="Duplicate event"
                        icon="sym_r_content_copy"
                        v-if="
                          useEventStore().getterUserHasPermission(
                            EventAttendeePermission.ManageEvent
                          ) ||
                          isOwnerOrAdmin ||
                          useEventStore().getterGroupMemberHasPermission(
                            GroupPermission.ManageEvents
                          )
                        "
                        @click="handleDuplicateEvent"
                      />
                      <MenuItemComponent
                        label="Manage attendees"
                        icon="sym_r_people"
                        v-if="
                          useEventStore().getterUserHasPermission(
                            EventAttendeePermission.ManageAttendees
                          )
                        "
                        @click="router.push({ name: 'EventAttendeesPage' })"
                      />
                      <MenuItemComponent
                        v-if="
                          event.status === EventStatus.Published &&
                          (useEventStore().getterUserHasPermission(
                            EventAttendeePermission.CancelEvent
                          ) ||
                          isOwnerOrAdmin ||
                          useEventStore().getterGroupMemberHasPermission(
                            GroupPermission.ManageEvents
                          ))
                        "
                        label="Cancel event"
                        icon="sym_r_event_busy"
                        @click="onCancelEvent"
                      />

                      <MenuItemComponent
                        v-if="
                          event.status === EventStatus.Cancelled &&
                          (useEventStore().getterUserHasPermission(
                            EventAttendeePermission.CancelEvent
                          ) ||
                          isOwnerOrAdmin ||
                          useEventStore().getterGroupMemberHasPermission(
                            GroupPermission.ManageEvents
                          ))
                        "
                        label="Republish event"
                        icon="sym_r_event_available"
                        @click="onRepublishEvent"
                      />

                      <q-separator />
                      <MenuItemComponent
                        label="Delete event"
                        v-if="
                          useEventStore().getterUserHasPermission(
                            EventAttendeePermission.DeleteEvent
                          ) ||
                          isOwnerOrAdmin ||
                          useEventStore().getterGroupMemberHasPermission(
                            GroupPermission.ManageEvents
                          )
                        "
                        icon="sym_r_delete"
                        @click="onDeleteEvent"
                      />
                    </q-list>
                  </q-btn-dropdown>
                </div>

                <div class="column q-gutter-md">
                  <!-- Share button -->
                  <q-btn-dropdown
                    no-caps
                    color="primary"
                    outline
                    icon="sym_r_share"
                    label="Share"
                    data-cy="share-button"
                    class="full-width action-button"
                  >
                    <q-list>
                      <MenuItemComponent
                        label="Bluesky"
                        icon="fab fa-bluesky"
                        icon-color="blue"
                        @click="shareTo('bluesky')"
                      />
                      <MenuItemComponent
                        label="Facebook"
                        icon="fab fa-facebook"
                        icon-color="blue"
                        @click="shareTo('facebook')"
                      />
                      <MenuItemComponent
                        label="X"
                        icon="fab fa-square-x-twitter"
                        icon-color="black"
                        @click="shareTo('x')"
                      />
                      <MenuItemComponent
                        label="LinkedIn"
                        icon="fab fa-linkedin"
                        icon-color="blue-8"
                        @click="shareTo('linkedin')"
                      />
                      <MenuItemComponent
                        label="WhatsApp"
                        icon="fab fa-whatsapp"
                        icon-color="green"
                        @click="shareTo('whatsapp')"
                      />
                      <MenuItemComponent
                        label="Email"
                        icon="sym_r_mail"
                        icon-color="red"
                        @click="shareToEmail"
                      />
                    </q-list>
                  </q-btn-dropdown>

                  <!-- Contact Organizers button - only show for attendees who don't have manage permissions -->
                  <q-btn
                    v-if="
                      useEventStore().getterUserIsAttendee() &&
                      !useEventStore().getterUserHasPermission(EventAttendeePermission.ManageEvent)
                    "
                    label="Contact Organizers"
                    color="primary"
                    outline
                    icon="sym_r_mail"
                    @click="onContactOrganizers"
                    data-cy="contact-organizers-btn"
                    no-caps
                    class="full-width action-button"
                  />

                  <!-- QR Code button -->
                  <q-btn
                    no-caps
                    color="primary"
                    outline
                    icon="sym_r_qr_code"
                    label="Generate QR Code"
                    data-cy="qr-code-button"
                    class="full-width action-button"
                    @click="showQRCodePopup = true"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Event Details -->
          <q-card class="q-mb-md">
            <q-card-section>
              <div class="text-h6">Event Details</div>

              <!-- Hosted by -->
              <EventLeadComponent />

              <!-- Date and time -->
              <q-item>
                <q-item-section side>
                  <q-icon name="sym_r_schedule" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ dateFormatting.formatWithTimezone(
                      event.startDate,
                      { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                      dateFormatting.getUserTimezone() || event.timeZone
                    ) }}
                  </q-item-label>
                  <q-item-label v-if="event.endDate">
                    {{ dateFormatting.formatWithTimezone(
                      event.endDate,
                      { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                      dateFormatting.getUserTimezone() || event.timeZone
                    ) }}
                  </q-item-label>
                  <q-item-label caption v-if="event.timeZone && dateFormatting.getUserTimezone() && event.timeZone !== dateFormatting.getUserTimezone()">
                    <div class="row items-center q-gutter-sm q-mt-sm">
                      <span class="text-italic">
                        Event time in original timezone ({{ event.timeZone }}):
                        {{ dateFormatting.formatWithTimezone(event.startDate, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }, event.timeZone) }}
                      </span>
                    </div>
                  </q-item-label>
                  <q-item-label caption>
                    <div class="row items-center q-gutter-sm q-mt-sm">
                      <span class="text-italic">
                        Dates shown in your local time{{ dateFormatting.getUserTimezone() ? ` (${dateFormatting.getUserTimezone()})` : '' }}
                      </span>
                    </div>
                  </q-item-label>
                </q-item-section>
              </q-item>

              <!-- Spots left -->
              <q-item v-if="event.maxAttendees">
                <q-item-section side>
                  <q-icon name="sym_r_group" />
                </q-item-section>
                <q-item-section>
                  <q-item-label v-if="spotsLeft > 0">
                    <q-badge color="warning" class="text-bold">
                      {{ spotsLeft }} {{ pluralize(spotsLeft, "spot") }} left
                    </q-badge>
                  </q-item-label>
                  <q-item-label v-else>
                    <q-badge color="negative" class="text-bold">
                      Event Full
                    </q-badge>
                  </q-item-label>
                </q-item-section>
              </q-item>

              <!-- Recurrence information -->
              <RecurrenceDisplayComponent v-if="event.isRecurring" :event="event" />

              <!-- Location and type -->
              <q-item>
                <q-item-section side>
                  <q-icon
                    label="In person"
                    v-if="event.type === 'in-person'"
                    icon="sym_r_person_pin_circle"
                    name="sym_r_person_pin_circle"
                  />
                  <q-icon
                    label="Online"
                    v-if="event.type === 'online'"
                    name="sym_r_videocam"
                  />
                  <q-icon
                    label="Hybrid"
                    v-if="event.type === 'hybrid'"
                    name="sym_r_diversity_2"
                  />
                </q-item-section>
                <q-item-section>
                  <div class="row items-center">
                    <q-item-label>{{ event.type }} event</q-item-label>
                    <q-badge
                      v-if="event.sourceType"
                      :color="getSourceColor(event.sourceType)"
                      class="q-ml-sm"
                    >
                      <q-icon
                        v-if="event.sourceType === 'bluesky'"
                        name="fa-brands fa-bluesky"
                        size="xs"
                        class="q-mr-xs"
                      />
                      {{ event.sourceType }}
                    </q-badge>
                    <a
                      v-if="event.atprotoUri"
                      :href="'https://pds.ls/' + event.atprotoUri"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="q-ml-sm"
                      title="View on AT Protocol"
                    >
                      <q-badge color="blue">
                        <q-icon name="fa-solid fa-at" size="xs" class="q-mr-xs" />
                        Published
                      </q-badge>
                    </a>
                  </div>
                  <q-btn
                    v-if="event.locationOnline"
                    no-caps
                    size="md"
                    align="left"
                    flat
                    padding="none"
                    target="_blank"
                    :href="event.locationOnline"
                    class="text-underline text-blue"
                    >Online link
                  </q-btn>
                  <q-item-label v-if="event.location" class="text-blue">
                    {{ event.location }}
                  </q-item-label>
                </q-item-section>
              </q-item>

              <!-- Map display when event has location -->
              <q-item v-if="event.lat && event.lon">
                <q-item-section>
                  <div class="q-mt-md">
                    <LeafletMapComponent
                      disabled
                      :lat="event.lat"
                      :lon="event.lon"
                    />
                  </div>
                </q-item-section>
              </q-item>
            </q-card-section>
          </q-card>

          <!-- Series occurrences (Desktop only) -->
          <q-card v-if="event.seriesSlug" class="q-mb-md gt-xs">
            <q-card-section>
              <div class="text-h6 q-mb-md">Upcoming Occurrences</div>

              <q-list bordered separator class="rounded-borders">
                <q-item
                  v-for="(occurrence, index) in upcomingOccurrences"
                  :key="index"
                  @click="occurrence.eventSlug ? navigateToEvent(occurrence.eventSlug) : handleUnmaterializedEvent(occurrence)"
                  clickable
                  v-ripple
                  :class="[occurrence.eventSlug ? 'scheduled-event' : 'potential-event']"
                >
                  <q-item-section avatar>
                    <q-avatar size="28px" color="primary" text-color="white">
                      {{ index + 1 }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ dateFormatting.formatWithTimezone(occurrence.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }, undefined) }}</q-item-label>
                    <q-item-label caption v-if="occurrence.eventSlug" class="text-positive">
                      <q-icon name="sym_r_check_circle" size="xs" class="q-mr-xs" />Scheduled event
                    </q-item-label>
                    <q-item-label caption v-else class="text-grey-7">
                      <q-icon name="sym_r_today" size="xs" class="q-mr-xs" />Potential event
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-icon
                      :name="occurrence.eventSlug ? 'sym_r_arrow_forward' : 'sym_r_event_available'"
                      :color="occurrence.eventSlug ? 'primary' : 'grey-7'"
                    />
                  </q-item-section>
                </q-item>

                <q-item v-if="upcomingOccurrences.length === 0">
                  <q-item-section>
                    <q-item-label>No upcoming occurrences found</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>

              <div class="row justify-between q-mt-sm">
                <q-btn
                  flat
                  color="grey"
                  label="Refresh Occurrences"
                  @click="loadUpcomingOccurrences"
                  class="text-weight-medium text-caption"
                />
                <q-btn
                  flat
                  color="primary"
                  label="View Series"
                  @click="navigateToEventSeries"
                  icon-right="sym_r_arrow_forward"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- Organizer section -->
          <q-card v-if="event?.group">
            <q-card-section>
              <div class="text-h6">Organizer</div>
              <div class="q-mt-md">
                <q-item clickable @click="navigateToGroup(event.group)">
                  <q-item-section avatar>
                    <q-avatar size="48px">
                      <img
                        v-if="event.group.image"
                        :src="getImageSrc(event.group.image)"
                        :alt="event.group.name"
                      />
                      <q-icon v-else name="sym_r_group" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ event.group.name }}</q-item-label>
                    <q-item-label caption
                      >{{ event.group.visibility }} group</q-item-label
                    >
                  </q-item-section>
                </q-item>
              </div>
            </q-card-section>
          </q-card>

        </div>
      </div>
    </div>

    <NoContentComponent
      data-cy="event-not-found"
      v-if="errorMessage"
      :label="errorMessage"
      icon="sym_r_error"
      @click="router.push({ name: 'EventsPage' })"
      button-label="Go to events"
    />

    <template v-if="!errorMessage">
      <q-separator class="q-my-lg" />

      <!-- Remove bottom margin by adding q-mb-none -->
      <div
        class="q-py-xl q-mb-none" :class="$q.dark.isActive ? 'bg-purple-600' : 'bg-purple-100'"
        style="
          width: 100vw;
          position: relative;
          left: 50%;
          right: 50%;
          margin-left: -50vw;
          margin-right: -50vw;
        "
      >
        <div class="q-mx-auto" style="max-width: 1201px; padding: 0 24px">
          <EventsListComponent
            data-cy="similar-events-component"
            label="Similar Events"
            :events="similarEvents"
            :loading="similarEventsLoading"
            :hide-link="true"
            layout="list"
          />
        </div>
      </div>
    </template>

    <!-- QR Code Dialog -->
    <q-dialog v-model="showQRCodePopup" @show="generateQRCode">
      <q-card style="min-width: 300px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">QR Code</div>
          <q-space />
          <q-btn icon="sym_r_close" flat round dense v-close-popup aria-label="Close QR Code dialog" />
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="q-mb-md text-center">
            <canvas ref="qrCanvas" style="max-width: 100%" />
          </div>
          <q-input
            v-model="currentUrl"
            label="Event Link"
            outlined
            readonly
            class="q-mb-md"
          />
          <q-btn
            label="Copy Link"
            color="primary"
            class="full-width"
            @click="copyToClipboard"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- We're keeping only the future events component and pointer to series, so removing the management dialogs -->
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteUpdate } from 'vue-router'
import { LoadingBar, useMeta, useQuasar } from 'quasar'
import { getImageSrc } from '../utils/imageUtils'
import { eventsApi } from '../api/events'
import LeafletMapComponent from '../components/common/LeafletMapComponent.vue'
import MenuItemComponent from '../components/common/MenuItemComponent.vue'
import { useEventDialog } from '../composables/useEventDialog'
import EventLeadComponent from '../components/event/EventLeadComponent.vue'
import { useEventStore } from '../stores/event-store'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import NoContentComponent from '../components/global/NoContentComponent.vue'
import { useNavigation } from '../composables/useNavigation'
import EventsListComponent from '../components/event/EventsListComponent.vue'
import { GroupPermission } from '../types/group'
import { EventAttendeePermission, EventStatus } from '../types/event'
import EventAttendeesComponent from '../components/event/EventAttendeesComponent.vue'
import EventMatrixChatComponent from '../components/event/EventMatrixChatComponent.vue'
import EventActivityFeedComponent from '../components/event/EventActivityFeedComponent.vue'
import {
  EventEntity
} from '../types'
import { pluralize } from '../utils/stringUtils'
import EventRSVPSection from '../components/event/EventRSVPSection.vue'
import { getSourceColor } from '../utils/eventUtils'
import RecurrenceDisplayComponent from '../components/event/RecurrenceDisplayComponent.vue'
import { useAuthStore } from '../stores/auth-store'
import { EventSeriesService } from '../services/eventSeriesService'
import dateFormatting from '../composables/useDateFormatting'
import { eventLoadingState } from '../utils/eventLoadingState'
import { useContactEventOrganizersDialog } from '../composables/useContactEventOrganizersDialog'
import { logger } from '../utils/logger'

// Define the type for occurrence
interface SeriesOccurrence {
  date: Date;
  eventSlug: string | null;
}

// Define interface for the attendee status change event
interface AttendeeStatusChangeDetail {
  eventSlug: string;
  status: string;
  timestamp: number;
}

interface AttendeeStatusChangeEvent extends Event {
  detail: AttendeeStatusChangeDetail;
}

// Define global window property
declare global {
  interface Window {
    lastEventPageLoad?: Record<string, number>;
  }
}

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const { navigateToGroup } = useNavigation()
const { openDeleteEventDialog, openCancelEventDialog, openRepublishEventDialog } = useEventDialog()
const { showContactDialog } = useContactEventOrganizersDialog()
const event = computed(() => useEventStore().event)
const errorMessage = computed(() => useEventStore().errorMessage)

// Get the event image source (only used when event actually has an image)
const eventImageSrc = computed(() => getImageSrc(event.value?.image))

const similarEvents = ref<EventEntity[]>([])
const similarEventsLoading = ref(false)
const upcomingOccurrences = ref([])
const usingClientSideGeneration = ref(false)

// QR Code and sharing functionality
const showQRCodePopup = ref(false)
const qrCanvas = ref<HTMLCanvasElement | null>(null)
const currentUrl = ref('')

const onDeleteEvent = () => {
  if (event.value) openDeleteEventDialog(event.value)
}

const onCancelEvent = () => {
  if (event.value) openCancelEventDialog(event.value)
}

const onRepublishEvent = () => {
  if (event.value) openRepublishEventDialog(event.value)
}

const onContactOrganizers = () => {
  if (event.value) {
    showContactDialog({
      event: {
        slug: event.value.slug,
        name: event.value.name
      }
    })
  }
}

// Sharing functionality
const shareUrls = {
  bluesky: (url: string) =>
    `https://bsky.app/intent/compose?text=${encodeURIComponent(url)}`,
  facebook: (url: string) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  x: (url: string, text: string) =>
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(
      url
    )}&text=${encodeURIComponent(text)}`,
  linkedin: (url: string) =>
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      url
    )}`,
  whatsapp: (url: string) =>
    `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`
}

const shareTo = (platform: keyof typeof shareUrls) => {
  const url = window.location.href
  const text = 'Check out this event on OpenMeet!'

  const shareUrl = shareUrls[platform](url, text)
  try {
    window.open(shareUrl, '_blank')
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to share content.' })
  }
}

const shareToEmail = () => {
  const subject = encodeURIComponent('Check out this event on OpenMeet!')
  const body = encodeURIComponent(
    `I found this interesting event: ${window.location.href}`
  )

  try {
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to share via email.' })
  }
}

// QR Code functionality
const generateQRCode = async () => {
  if (!qrCanvas.value) return

  currentUrl.value = window.location.href

  try {
    const QRCode = await import('qrcode')
    await QRCode.default.toCanvas(qrCanvas.value, currentUrl.value)
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to generate QR code.' })
  }
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(currentUrl.value)
    $q.notify({ type: 'positive', message: 'Link copied to clipboard!' })
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to copy link.' })
  }
}

// Handle attendee status changes - EventMatrixChatComponent now handles Matrix integration
const handleAttendeeStatusChanged = async (e: Event) => {
  // Custom events have a detail property
  if (!e || !('detail' in e)) return

  // Use the properly typed event
  const customEvent = e as AttendeeStatusChangeEvent
  const { eventSlug } = customEvent.detail
  // Attendance status change debug info available

  // The EventMatrixChatComponent will handle Matrix room joining automatically
  // We just need to log the change here for debugging purposes
  if (eventSlug === route.params.slug) {
    // Status change logged
  }
}

onMounted(() => {
  // Listen for attendance status changes (sent from EventAttendanceButton.vue)
  window.addEventListener('attendee-status-changed', handleAttendeeStatusChanged)
})

onBeforeUnmount(() => {
  // Clean up event listener
  window.removeEventListener('attendee-status-changed', handleAttendeeStatusChanged)
  useEventStore().$reset()
})

useMeta({
  title: event.value?.name,
  meta: {
    description: { content: event.value?.description },
    'og:image': { content: getImageSrc(event.value?.image) }
  }
})

const loaded = ref(false)

// Check if we're running in development mode
const isDevelopmentMode = computed(() => {
  return import.meta.env.MODE === 'development' ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1'
})

onMounted(async () => {
  const eventSlug = route.params.slug as string
  LoadingBar.start()
  // console.log('EventPage mounted, loading data for:', eventSlug)

  // Check if we've recently loaded this event to avoid duplicate/competing loads
  const now = Date.now()
  const lastLoad = eventLoadingState.getLastEventPageLoad(eventSlug)
  const timeSinceLastLoad = now - lastLoad

  // Load event data
  try {
    // Always track when we load this event
    eventLoadingState.setLastEventPageLoad(eventSlug, now)

    // IMPORTANT: Set a flag to indicate this event is being loaded
    // This allows child components to avoid making redundant API calls
    eventLoadingState.setEventBeingLoaded(eventSlug)

    // First, load the event data and wait for it to complete
    // This ensures child components have access to event and attendance data
    if (!useEventStore().event || useEventStore().event.slug !== eventSlug || timeSinceLastLoad > 2000) {
      await useEventStore().actionGetEventBySlug(eventSlug)
      // console.log('Event data loaded, now child components can use this data')
      // DEBUG: Log timezone information (only in development mode)
      if (isDevelopmentMode.value) {
        // Debug timezone info available
      }
    } else {
      // console.log('Using existing event data from store, skipping reload')
    }

    // Then load non-critical data in parallel
    await Promise.all([
      // Load similar events
      loadSimilarEvents(eventSlug),

      // Load series data if applicable
      useEventStore().event?.seriesSlug ? loadUpcomingOccurrences() : Promise.resolve()
    ])

    // Log warning for navigation issues
    if (!useEventStore().event?.seriesSlug && useEventStore().event?.seriesId) {
      logger.warn('Event has seriesId but no seriesSlug, navigation issues possible')
    }

    /**
     * Matrix room joining is delegated to MatrixChatGateway component,
     * which is rendered within EventMatrixChatComponent on this page.
     * This ensures consistent room joining logic across all chat contexts
     * (events, groups, DMs) and proper separation of concerns.
     */
  } catch (error) {
    logger.error('Error loading event data:', error)
  } finally {
    // Clear the loading flag when done
    eventLoadingState.setEventBeingLoaded(null)
    LoadingBar.stop()
  }
})

// Update the loadSimilarEvents function back to original
const loadSimilarEvents = async (slug: string) => {
  similarEventsLoading.value = true
  try {
    const response = await eventsApi.similarEvents(slug)
    similarEvents.value = response.data
  } catch (error) {
    console.error('Failed to load similar events:', error)
  } finally {
    similarEventsLoading.value = false
  }
}

// Enhanced onBeforeRouteUpdate to join chat room when navigating between events
onBeforeRouteUpdate(async (to) => {
  loaded.value = false
  if (to.params.slug) {
    try {
      LoadingBar.start()
      await Promise.all([
        eventsApi.getBySlug(String(to.params.slug)).then((response) => {
          useEventStore().event = response.data
        }),
        loadSimilarEvents(String(to.params.slug))
      ])

      // Matrix room joining is handled by MatrixChatGateway component
    } catch (error) {
      logger.error('Failed to load event:', error)
    } finally {
      loaded.value = true
      LoadingBar.stop()
    }
  }
})

const spotsLeft = computed(() =>
  event.value?.maxAttendees
    ? event.value.maxAttendees - (event.value.attendeesCount || 0)
    : 0
)

// Revert navigateToEventSeries to original
const navigateToEventSeries = async () => {
  // Series navigation debug info

  // Primary navigation approach - using seriesSlug
  if (event.value?.seriesSlug) {
    const url = `/event-series/${event.value.seriesSlug}`
    // console.log('Navigating to:', url)
    router.push(url)
    return
  }

  // Fallback - if somehow we have seriesId but no seriesSlug, use the event name
  // This should rarely happen if the API is working correctly
  if (event.value?.seriesId && event.value?.name) {
    logger.warn('No seriesSlug found, using fallback navigation')

    // Create a simple slug from the event name
    const fallbackSlug = event.value.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // console.log('No seriesSlug found, trying fallback with event name:', fallbackSlug)

    const url = `/event-series/${fallbackSlug}`
    // console.log('Navigating to fallback URL:', url)
    router.push(url)
    return
  }

  // As a last resort, go to the events list
  logger.warn('Unable to navigate to series - missing seriesSlug')
  router.push('/events')
}

// Revert handleUnmaterializedEvent to original
const handleUnmaterializedEvent = (occurrence: SeriesOccurrence) => {
  // If the event is unmaterialized (no eventSlug), we'll show a temporary view
  // with option to materialize
  if (event.value) {
    // Use query parameter approach for template views
    router.push({
      name: 'EventPage',
      params: { slug: event.value.slug },
      query: {
        templateView: 'true',
        occurrenceDate: occurrence.date.toISOString()
      }
    })
  }
}

// Revert loadUpcomingOccurrences to original
const loadUpcomingOccurrences = async () => {
  if (event.value?.seriesSlug) {
    try {
      const seriesSlug = event.value.seriesSlug
      // console.log('Loading upcoming occurrences for series:', seriesSlug)

      // First, load all materialized events from the series directly
      // to ensure we don't miss any events with custom dates
      try {
        // console.log('Loading all materialized events for series first')
        const allSeriesEvents = await EventSeriesService.getEventsBySeriesSlug(seriesSlug)
        // console.log(`Found ${allSeriesEvents.length} materialized events for series`)

        // Create a map of already materialized events by date (roughly)
        const materializedEvents = new Map()

        // Only include future events
        const now = new Date()
        allSeriesEvents
          .filter(evt => new Date(evt.startDate) > now)
          .forEach(evt => {
            // Use date string without time for rough matching
            const dateKey = new Date(evt.startDate).toISOString().split('T')[0]
            materializedEvents.set(dateKey, evt)
          })

        // console.log(`Found ${materializedEvents.size} future materialized events to include`)

        // Now load the series to get the recurrence rule for unmaterialized future occurrences
        // console.log('Fetching complete series data for recurrence pattern')
        await EventSeriesService.getBySlug(seriesSlug)

        // Log the recurrence rule for debugging (only in development mode)
        if (isDevelopmentMode.value) {
          // console.log('Series recurrence rule:', series.recurrenceRule)
          // console.log('Series timezone:', series.timeZone)
          // console.log('USING API-BASED OCCURRENCE GENERATION for all patterns')
        }
        usingClientSideGeneration.value = false

        // Get occurrences from the API
        const response = await EventSeriesService.getOccurrences(seriesSlug, 10, false)

        if (isDevelopmentMode.value && response.length > 0) {
          // API occurrence debug info available
        }

        // Filter to future occurrences
        const apiOccurrences = response
          .filter(occurrence => new Date(occurrence.date) > now)
          .map(occurrence => ({
            date: new Date(occurrence.date),
            eventSlug: occurrence.event?.slug || null
          }))

        // Add any materialized events that are not in the API response
        materializedEvents.forEach((evt) => {
          // Check if this materialized event is already included
          const alreadyIncluded = apiOccurrences.some(
            occ => occ.eventSlug === evt.slug
          )

          if (!alreadyIncluded) {
            // Adding missing materialized event from API approach
            apiOccurrences.push({
              date: new Date(evt.startDate),
              eventSlug: evt.slug
            })
          }
        })

        // Sort by date, limit to next 5 occurrences
        upcomingOccurrences.value = apiOccurrences
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .slice(0, 5)

        if (isDevelopmentMode.value) {
          // console.log('Final API-based occurrences:', upcomingOccurrences.value)
        }
      } catch (err) {
        logger.error('Error in combined approach, falling back to API only:', err)

        // Fall back to API-only approach if the combined approach fails
        const response = await EventSeriesService.getOccurrences(seriesSlug, 10)

        // Filter out only future occurrences
        const now = new Date()
        upcomingOccurrences.value = response
          .filter(occurrence => new Date(occurrence.date) > now)
          .map(occurrence => ({
            date: new Date(occurrence.date),
            eventSlug: occurrence.event?.slug || null
          }))
          .slice(0, 5) // Limit to next 5 occurrences

        if (isDevelopmentMode.value) {
          // console.log('Fallback API occurrences:', upcomingOccurrences.value)
        }
      }

      // Check if occurrences look weekly or monthly (only in development mode)
      if (isDevelopmentMode.value && upcomingOccurrences.value.length >= 2) {
        // Pattern analysis debug info available
      }
    } catch (error) {
      logger.error('Failed to load upcoming occurrences:', error)
    }
  }
}

const navigateToEvent = (eventSlug: string) => {
  router.push(`/events/${eventSlug}`)
}

// No longer needed - we always use API generation

// Check if we're in template view mode (showing a future unmaterialized occurrence)
const isTemplateView = computed(() => {
  return route.query.templateView === 'true' && !!route.query.occurrenceDate
})

// Get the projected date for template view
const templateDate = computed(() => {
  if (isTemplateView.value && route.query.occurrenceDate) {
    return route.query.occurrenceDate as string
  }
  return null
})

// Update the handleEditEvent function back to original
const handleEditEvent = async () => {
  // If in template view, we need to materialize this event instance first
  if (isTemplateView.value && templateDate.value && event.value) {
    try {
      LoadingBar.start()

      // Use the centralized materialization function with false for auto-navigation
      const materializedEvent = await useEventStore().actionMaterializeOccurrence(
        event.value.seriesSlug as string,
        new Date(templateDate.value).toISOString(),
        false // Don't navigate automatically, we'll handle it here
      )

      // Navigate to the newly materialized event edit page
      if (materializedEvent && materializedEvent.slug) {
        await router.push({
          name: 'DashboardEventPage',
          params: { slug: materializedEvent.slug }
        })
      } else {
        console.error('Failed to materialize event occurrence: No slug returned')
      }
    } catch (error) {
      console.error('Error materializing event occurrence:', error)
      // Show error notification
      $q.notify({
        type: 'negative',
        message: 'Failed to materialize event: ' + (error.message || 'Unknown error')
      })
    } finally {
      LoadingBar.stop()
    }
  } else {
    // Regular edit for already materialized events
    router.push({
      name: 'DashboardEventPage',
      params: { slug: event.value?.slug }
    })
  }
}

const handleDuplicateEvent = () => {
  if (event.value?.slug) {
    router.push({
      name: 'DashboardEventCreatePage',
      query: { duplicate: event.value.slug }
    })
  }
}

// Update the isOwnerOrAdmin computed property
const isOwnerOrAdmin = computed(() => {
  if (!event.value?.series?.user) return false

  const authStore = useAuthStore()

  // Check if user is owner
  const isOwner = event.value.series.user.id === authStore.getUserId

  // Check if user is admin (has manage events permission)
  const isAdmin = useEventStore().getterGroupMemberHasPermission(GroupPermission.ManageEvents)

  return isOwner || isAdmin
})

</script>

<style scoped lang="scss">
.bio-content {
  max-width: 100%;

  :deep(a) {
    color: var(--q-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &::after {
      display: none;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }

  :deep(blockquote) {
    border-left: 4px solid var(--q-primary);
    margin-left: 0;
    padding-left: 16px;
    color: rgba(0, 0, 0, 0.7);
  }
}

.series-occurrences {
  .scheduled-event {
    background-color: rgba(33, 150, 83, 0.05);
    border-left: 3px solid var(--q-positive);

    &:hover {
      background-color: rgba(33, 150, 83, 0.1);
    }
  }

  .potential-event {
    border-left: 3px solid var(--q-grey-7);
    opacity: 0.85;

    &:hover {
      background-color: rgba(0, 0, 0, 0.03);
      opacity: 1;
    }
  }
}

/* Action button styles for uniformity */
.action-button {
  min-height: 44px; /* Ensure consistent height */

  :deep(.q-btn) {
    min-height: 44px;
    width: 100%;
  }

  :deep(.q-btn__content) {
    justify-content: flex-start;
    padding: 0 16px;
  }
}

/* Attendance section styling */
.attendance-section {
  .attendance-status {
    padding: 8px 12px;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.03);
    border: 1px solid rgba(0, 0, 0, 0.1);
    text-align: center;

    .q-icon {
      font-size: 1.1em;
    }
  }

  .rsvp-instructions {
    padding: 12px 16px;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(33, 150, 83, 0.05) 0%, rgba(33, 150, 83, 0.02) 100%);
    border: 1px solid rgba(33, 150, 83, 0.15);

    .q-icon {
      color: var(--q-positive);
      font-size: 1.1em;
    }
  }
}

/* RSVP Banner Styling */
.rsvp-required-banner {
  background: linear-gradient(135deg, rgba(34, 178, 218, 0.15) 0%, rgba(34, 178, 218, 0.08) 100%);
  border-left: 4px solid var(--q-info);

  :deep(.q-banner__avatar) {
    color: var(--q-info);
  }
}

/* Banner styles moved to EventAttendanceStatus.vue component */

/* Mobile RSVP card styling */
@media (max-width: 1023px) {
  .event-actions-card {
    /* Add a subtle highlight to make it stand out on mobile */
    border-top: 3px solid var(--q-info);
  }
}

/* Event Actions content - ensure proper width constraints */
.event-actions-content {
  /* Ensure all direct children respect the container width */
  > * {
    width: 100%;
    max-width: 100%;
  }
}

/* Mobile responsive improvements */
@media (max-width: 768px) {
  .c-event-page {
    /* Better mobile column layout */
    .row.q-col-gutter-md {
      /* On mobile, ensure proper stacking */
      .col-8 {
        width: 100%;
        order: 1;
      }

      .col-12.col-md-4 {
        width: 100%;
        order: 2;
        margin-top: 16px;
      }
    }

    /* Improve button layouts on mobile */
    .row.items-start.q-gutter-md {
      flex-direction: column;
      gap: 12px;

      .col-4 {
        width: 100%;
      }
    }

    /* Better spacing for event actions */
    .row.items-center.justify-between {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;

      .col-12.col-sm-6 {
        width: 100%;

        &.row.q-gutter-md.justify-end {
          justify-content: flex-start;
        }
      }
    }

    /* Make cards more mobile-friendly */
    .q-card {
      margin-bottom: 12px;
    }

    /* Better spacing for occurrence list */
    .series-occurrences {
      .q-list {
        border-radius: 8px;
      }
    }
  }
}
</style>
