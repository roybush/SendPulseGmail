<template>
  <div class="sp-add-mails-holder">
    <div>
      <span v-if='list' class='sp-header'>Adding email to list {{ list.name }} </span>
      <span class="sp-link right" @click="fetchAll">Fetch from facebook</span>
    </div>
    <div class="scrollable">
    <table class='sp-table'>
      <template v-for='info in mailsInfo'>
        <tr>
          <td>
            <input type='checkbox' class='sp-checkbox' v-model='info.checked'/>
          </td>
          <td class="mailCont">{{ info.mail }}</td>
          <td><input class='sp-input' type='text' placeholder='First Name' v-model='info.firstName'/></td>
          <td><input class='sp-input' type='text' placeholder='Last Name' v-model='info.lastName'/></td>
          <td>
            <button @click='loadFromFb(info)' class='T-I-atl T-I sp-btn-small' :disabled='info.loading'>
              <span class='icon-spin6'></span><template v-if="!info.loading">FB</template>
            </button>
          </td>
        </tr>
        <tr v-if="info.err">
          <td colspan="5">
            <error :content="info.err" class="nomarg"/>
          </td>
        </tr>
      </template>

    </table>
    </div>
    <div class='addEmailBtns'>
      <error :content='error'/>
      <button type='button' class='T-I-atl T-I' :disabled='loading' @click='add'>
        <span class='icon-spin6'></span> Add
      </button>
      <input type='button' class='T-I-atl T-I' value='Cancel' @click='cancel'/>
    </div>
  </div>
</template>
<style lang='sass' scoped>
  .right
    float: right
  .nomarg
    margin: 0
  .scrollable
    max-height: 400px
    max-height: calc(100vh - 200px)
    overflow-y: auto

  .addEmailBtns
    padding-top: 5px
  .mailCont
    min-width: 180px
    max-width: 180px
    width: 180px
    word-break: break-all
    white-space: normal

</style>
<script lang='ts'>

  import {api, gmailTracker} from '../helpers/utils';
  import Error from './Error.vue';
  import Vue, { ComponentOptions }  from 'vue';
  import {Mail, MailList, Page} from '../model';

  interface IAddMails extends Vue {
    list: MailList;
    mails: string[];
    mailsInfo: CheckedMail[];
    reqN: number;
    loadFromFb: Function;
    error: string;
    loading: boolean;
  }

  declare type CheckedMail = {
    mail: string;
    err: string;
    firstName: string;
    lastName: string;
    checked: boolean;
    loading: boolean;
  };

  export default {
    name: 'add-mails',
    components: {
      Error
    },
    props: {
      list: Object,
      mails: {
        type: Array,
        default: function() {
          return [];
        }
      }
    },
    data: function() {
      return {
        loading: false,
        error: '',
        reqN: 0,
        mailsInfo: [],
      };
    },
    watch: {
      mails: function(newValue) {
        this.mailsInfo = newValue.map(mail => ({
          mail: mail,
          firstName: '',
          lastName: '',
          loading: false,
          checked: true,
          err: ''
        }));
        this.mailsInfo.forEach(m => {
          m.loading = true;
          api.fetchEmailData(this.list.id, m.mail, (ok, err) => {
          m.loading = false;
            if (err) {
              m.err = err;
            } else if (ok) {
              m.firstName = ok.firstName;
              m.lastName = ok.lastName;
            }
          });
        });
      }
    },
    methods: {
      fetchAll: function() {
        this.mailsInfo.forEach(e => {
          if (e => e.checked) {
            this.loadFromFb(e);
          }
        });
      },
      loadFromFb: function (list: CheckedMail) {
        list.loading = true;
        api.getUserInfoByEmail(list.mail, (ok, err) => {
          list.loading = false;
          if (err) {
              list.err = err;
          } else {
            list.err = '';
            list.firstName = ok.firstName || '';
            list.lastName = ok.lastName || '';
          }
        });
      },
      add: function() {
        let checkedEmails: CheckedMail[] = this.mailsInfo.filter(e => e.checked);
        if (checkedEmails.length) {
          let mails: Mail[] = checkedEmails.map(m => ({
            email: m.mail,
            variables: {
              firstName: m.firstName,
              lastName: m.lastName
            }
          }));
          this.loading = true;
          api.addEmailsToList(this.list.id, mails, (ok, err) => {
            this.loading = false;
            if (err) {
              this.reqN++;
              this.error = `[${this.reqN}] Error adding mail(s) to list: ${err}`;
            } else {
              this.error = '';
              let checkedEmailsNames = checkedEmails.map(m => m.mail).join(', ');
              gmailTracker.showGrowl(`Emails [${checkedEmailsNames}] have been saved`);
              this.$emit('setPage', Page.NONE);
            }
          });
        } else {
          this.error = 'You should select at least one email';
        }
      },
      cancel: function() {
        this.$emit('setPage', Page.NONE);
      }
    }
  } as ComponentOptions<IAddMails>;
</script>
