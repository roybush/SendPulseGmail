<template>
  <div>
    <div class='J-N sp-list-header'>Choose list</div>
    <loading v-if='loading' what='mailing lists' class='J-N'></loading>
    <template v-else-if='error'>
      <error class="J-N" :content='error'/>
      <hovered  class="sp-link J-N" @click="loadList">
        Reload
      </hovered>
    </template>
    <template v-else class='sp-list'>
      <hovered :key="mailLists.id" v-for='mailList in mailLists' class='J-JK' @click='addToList(mailList)'>
        {{ mailList.name }}
      </hovered>
    </template>
    <div class='J-Kh' style='user-select: none;'></div>
  </div>
</template>
<style lang="sass" scoped>
  .J-JK
    max-width: 200px
    text-overflow: ellipsis
    overflow: hidden
</style>
<script lang='ts'>

  import {gmailTracker, api} from '../helpers/utils';
  import Error from './Error';
  import Loading from './Loading';
  import Hovered from './Hovered';
  import Vue, { ComponentOptions }  from 'vue';
  import {MailList, Page} from '../model';

  interface IMailLists extends Vue {
    mailLists: MailList[];
    loadList (): void;
    addToList (): void;
    error: string;
    tries: number;
    loading: boolean;
  }

  export default {
    name: 'mail-lists',
    components: {
      Loading,
      Error,
      Hovered
    },
    data: function() {
      return {
        loading: false,
        error: '',
        tries: 0,
        mailLists: [],
      };
    },
    created: function() {
      this.loadList();
    },
    methods: {
      addToList: function(list: IMailLists) {
        this.$emit('listClick', list);
      },
      loadList: function() {
        this.loading = true;
        api.getMailLists((mails, err) => {
          this.loading = false;
          if (err) {
            this.tries++;
            this.error = `Error while fetching mailLists [${this.tries}]: ${err}`;
          } else {
            this.error = '';
            this.mailLists = mails;
          }
        });
      }
    }
  } as ComponentOptions<IMailLists>;
</script>
