<template>
  <div class="categories-list q-pa-md">
    <h2 class="text-h4 q-mb-md">Categories</h2>
    <q-list bordered separator>
      <q-expansion-item
        v-for="category in categories"
        :key="category.id"
        :label="category.name"
        :caption="category.description"
        icon="sym_r_category"
        expand-separator
        class="category-item"
      >
        <q-card>
          <q-card-section>
            <q-list dense>
              <q-item v-for="subCategory in category.subCategories" :key="subCategory.id">
                <q-item-section>
                  <q-item-label>{{ subCategory.name }}</q-item-label>
                  <q-item-label caption>{{ subCategory.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface SubCategory {
  id: string;
  name: string;
  description: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  subCategories: SubCategory[];
}

const categories = ref<Category[]>([
  {
    id: 'technology',
    name: 'Technology',
    description: 'Groups related to various technology fields',
    subCategories: [
      {
        id: 'developers',
        name: 'Developers & Programmers',
        description: 'Groups for coding enthusiasts and software developers.'
      },
      {
        id: 'ai-data-science',
        name: 'AI & Data Science',
        description: 'Communities focused on artificial intelligence and data analytics.'
      },
      {
        id: 'cybersecurity',
        name: 'Cybersecurity',
        description: 'Groups dedicated to cybersecurity professionals and enthusiasts.'
      },
      {
        id: 'tech-innovators',
        name: 'Tech Innovators',
        description: 'Communities for discussing and developing new technologies.'
      }
    ]
  },
  {
    id: 'business',
    name: 'Business & Entrepreneurship',
    description: 'Groups focused on business and entrepreneurial activities',
    subCategories: [
      {
        id: 'startup-founders',
        name: 'Startup Founders',
        description: 'Groups for entrepreneurs launching new ventures.'
      },
      {
        id: 'marketing',
        name: 'Marketing Professionals',
        description: 'Communities for sharing marketing strategies and trends.'
      },
      {
        id: 'finance',
        name: 'Finance & Investment',
        description: 'Groups focused on personal finance, investing, and financial planning.'
      },
      {
        id: 'business-leaders',
        name: 'Business Leaders',
        description: 'Communities for executives and managers to share leadership insights.'
      }
    ]
  }
  // Add more categories here...
])
</script>

<style scoped>
.categories-list {
  max-width: 800px;
  margin: 0 auto;
}

.category-item {
  margin-bottom: 8px;
}
</style>
