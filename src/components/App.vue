<template>
  <div class='sp-main-wrapper' ref="listId">
    <sp-btn @click='toggleList'/>
    <div class='sp-absolute-list J-M' v-show='showList'>
      <mail-lists @listClick='showAddEmailsPage' v-if="loggedIn" v-show="mailsSelected"/>
      <template v-if="loggedIn">
        <div class="J-N sp-list-header">Logged as {{ clientId }}...</div>
        <hovered  class="sp-link J-N" @click="logout">
         Logout
        </hovered>
      </template>
      <hovered class="J-N" v-else>
        <span class="sp-link" @click="displayLoginPage">Log In</span>
      </hovered>
    </div>
      <add-mails v-show='showAddPage' :mails='mails' :list='currentList' @setPage='setPage'/>
      <login v-show='showLoginPage' @setPage='setPage' @login="setLoginInfo"/>
  </div>
</template>
<script lang='ts'>
  import {gmailTracker, api} from '../helpers/utils';
  import MailLists from './MailLists.vue';
  import Login from './Login.vue';
  import Hovered from './Hovered.vue';
  import AddMails from './AddMails.vue';
  import Vue, { ComponentOptions }  from 'vue';
  import SpBtn from './SpBtn.vue';
  import {MailList, Page} from '../model';

  interface IApp extends Vue {
    mails: string[];
    showList: boolean;
    page: Page;
    mailsSelected: boolean;
    clientId: string;
    loggedIn: boolean;
    showAddPage: boolean;
    currentList: MailList;
  }

  export default {
    name: 'app',
    data() {
      return {
        mails: [],
        loggedIn: false,
        showList: false,
        mailsSelected: false,
        page: Page.NONE,
        clientId: '',
        currentList: null
      };
    },
    created: function() {
      this.loggedIn = api.token && api.expires > Date.now();
      this.clientId = api.clientId;
    },
    components: {
      SpBtn,
      AddMails,
      Hovered,
      MailLists,
      Login
    },
    computed: {
      showAddPage: function() {
        return this.page === Page.ADD;
      },
      showLoginPage: function() {
        return this.page === Page.LOGIN;
      }
    },
    watch: {
      showList: function(nv) {
        if (nv) {
          this.$nextTick(function () {
            gmailTracker.registerOuterClick(this.$refs.listId, () => {
              this.showList = false;
            });
          });
        }
      }
    },
    methods: {
      displayLoginPage: function() {
        this.page = Page.LOGIN;
        this.showList = false;
      },
      setLoginInfo: function() {
        this.loggedIn = true;
        this.clientId = api.clientId;
        this.page = Page.NONE;
      },
      logout: function() {
        this.loggedIn = false;
        this.clientId = '';
        api.clientId = '';
        api.token = '';
        api.expires = 0;
      },
      toggleList: function() {
        this.showList = !this.showList;
        if (this.showList) {
          this.mailsSelected = gmailTracker.getCheckedEmails().length !== 0;
        }
      },
      showAddEmailsPage: function(list: MailList) {
        this.mails = gmailTracker.getCheckedEmails();
        this.currentList = list;
        this.page = Page.ADD;
        this.showList = false;
      },
      setPage: function(newPage: Page) {
        this.page = newPage;
      }
    }
  } as ComponentOptions<IApp>;


</script>
